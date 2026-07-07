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

    test('finds remote release-date conflicts from the full selected documents beyond matched opening spans', async () => {
        const nominalOpening = 'Nominal date full scan source is the scoped comparison document for full-document release-date augmentation.';
        const fieldOpening = 'Field date full scan source is the scoped comparison document for full-document release-date augmentation.';
        const nominalDate = 'The migration release date is 2026-07-01 in the remote nominal date appendix.';
        const fieldDate = 'The migration release date is 2026-08-15 in the remote field date appendix.';
        const nominalDocument = [
            '# Nominal Date Full Scan Source',
            nominalOpening,
            '',
            'This opening section is intentionally separate from the remote release-date statement.',
            '',
            'Local date filler paragraph one keeps the remote appendix away from the matched opening span.',
            '',
            'Local date filler paragraph two keeps the remote appendix away from the matched opening span.',
            '',
            'Local date filler paragraph three keeps the remote appendix away from the matched opening span.',
            '',
            'Local date filler paragraph four keeps the remote appendix away from the matched opening span.',
            '',
            'Local date filler paragraph five keeps the remote appendix away from the matched opening span.',
            '',
            'Local date filler paragraph six keeps the remote appendix away from the matched opening span.',
            '',
            '## Remote Nominal Date Appendix',
            nominalDate,
        ].join('\n');
        const fieldDocument = [
            '# Field Date Full Scan Source',
            fieldOpening,
            '',
            'This opening section is intentionally separate from the remote release-date statement.',
            '',
            'Local date filler paragraph one keeps the remote appendix away from the matched opening span.',
            '',
            'Local date filler paragraph two keeps the remote appendix away from the matched opening span.',
            '',
            'Local date filler paragraph three keeps the remote appendix away from the matched opening span.',
            '',
            'Local date filler paragraph four keeps the remote appendix away from the matched opening span.',
            '',
            'Local date filler paragraph five keeps the remote appendix away from the matched opening span.',
            '',
            'Local date filler paragraph six keeps the remote appendix away from the matched opening span.',
            '',
            '## Remote Field Date Appendix',
            fieldDate,
        ].join('\n');
        const nominalAtom = makeAtom({
            id: 'atom_nominal_date_full_scan_source',
            documentId: 'doc_nominal_date_full_scan_source',
            sourcePath: 'Knowledge_Base/ragdatefullscan/nominal date full scan source.md',
            title: 'Nominal Date Full Scan Source',
            content: nominalOpening,
            keywords: ['date', 'release', 'full scan'],
        });
        const fieldAtom = makeAtom({
            id: 'atom_field_date_full_scan_source',
            documentId: 'doc_field_date_full_scan_source',
            sourcePath: 'Knowledge_Base/ragdatefullscan/field date full scan source.md',
            title: 'Field Date Full Scan Source',
            content: fieldOpening,
            keywords: ['date', 'release', 'full scan'],
        });
        const items: KnowledgeQueryItem[] = [
            {
                ...makeQueryItem({ atom: nominalAtom }),
                atom: nominalAtom,
                evidenceSpans: [
                    makeEvidenceSpan({
                        id: 'evidence_nominal_date_opening',
                        documentId: nominalAtom.documentId,
                        sourcePath: nominalAtom.sourcePath,
                        startOffset: nominalDocument.indexOf(nominalOpening),
                        endOffset: nominalDocument.indexOf(nominalOpening) + nominalOpening.length,
                        startLine: 2,
                        endLine: 2,
                        snippet: nominalOpening,
                    }),
                ],
            },
            {
                ...makeQueryItem({ atom: fieldAtom }),
                atom: fieldAtom,
                evidenceSpans: [
                    makeEvidenceSpan({
                        id: 'evidence_field_date_opening',
                        documentId: fieldAtom.documentId,
                        sourcePath: fieldAtom.sourcePath,
                        startOffset: fieldDocument.indexOf(fieldOpening),
                        endOffset: fieldDocument.indexOf(fieldOpening) + fieldOpening.length,
                        startLine: 2,
                        endLine: 2,
                        snippet: fieldOpening,
                    }),
                ],
            },
        ];
        const documentsById = new Map([
            [nominalAtom.documentId, nominalDocument],
            [fieldAtom.documentId, fieldDocument],
        ]);

        const assembly = await assembleRagEvidenceContext({
            query: 'compare nominal date full scan source with field date full scan source',
            items,
            sourceResolver: async (request) => ({
                documentId: request.documentId,
                sourcePath: request.sourcePath,
                content: documentsById.get(request.documentId) || '',
            }),
            paragraphWindow: 1,
            budget: {
                maxFragments: 8,
                maxCharsPerFragment: 900,
                maxTotalChars: 3000,
            },
        });

        const directSupportText = assembly.fragments
            .filter((fragment) => fragment.role === 'direct_support')
            .map((fragment) => fragment.text)
            .join('\n');
        expect(directSupportText).not.toContain('2026-07-01');
        expect(directSupportText).not.toContain('2026-08-15');

        const conflictFragment = assembly.fragments.find((fragment) => fragment.role === 'conflict');
        expect(conflictFragment).toEqual(expect.objectContaining({
            sourceBoundary: 'full_document',
            citationIds: expect.arrayContaining([
                'evidence_nominal_date_opening',
                'evidence_field_date_opening',
            ]),
        }));
        expect(conflictFragment?.text).toContain(nominalDate);
        expect(conflictFragment?.text).toContain(fieldDate);
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

    test('marks categorical state facts in the same section as conflicting evidence', async () => {
        const enabledState = 'The migration gate status is enabled in the release checklist.';
        const disabledState = 'The migration gate status is disabled in the rollback appendix.';
        const fullDocument = [
            '# State Status Conflict Probe',
            '',
            'State status conflict probe validates that categorical state contradictions are not flattened into one stable status.',
            '',
            '## Gate Status',
            enabledState,
            '',
            'Operators must inspect the release checklist before publishing a status.',
            '',
            disabledState,
            'Operators must resolve which status record is active before release.',
        ].join('\n');
        const atom = makeAtom({
            id: 'atom_conflicting_state_status',
            documentId: 'doc_conflicting_state_status',
            sourcePath: 'Knowledge_Base/ragstateconflict/state status conflict probe.md',
            title: 'State Status Conflict Probe',
            content: enabledState,
            keywords: ['state', 'status', 'conflict'],
        });
        const item: KnowledgeQueryItem = {
            ...makeQueryItem({ atom }),
            atom,
            evidenceSpans: [
                makeEvidenceSpan({
                    id: 'evidence_enabled_state_status',
                    documentId: atom.documentId,
                    sourcePath: atom.sourcePath,
                    startOffset: fullDocument.indexOf(enabledState),
                    endOffset: fullDocument.indexOf(enabledState) + enabledState.length,
                    startLine: 6,
                    endLine: 6,
                    snippet: enabledState,
                }),
                makeEvidenceSpan({
                    id: 'evidence_disabled_state_status',
                    documentId: atom.documentId,
                    sourcePath: atom.sourcePath,
                    startOffset: fullDocument.indexOf(disabledState),
                    endOffset: fullDocument.indexOf(disabledState) + disabledState.length,
                    startLine: 10,
                    endLine: 10,
                    snippet: disabledState,
                }),
            ],
        };

        const assembly = await assembleRagEvidenceContext({
            query: 'what is state status conflict probe?',
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
                'evidence_enabled_state_status',
                'evidence_disabled_state_status',
            ]),
            startLine: 6,
            endLine: 11,
        }));
        expect(conflictFragment?.text).toContain(enabledState);
        expect(conflictFragment?.text).toContain(disabledState);
        expect(conflictFragment?.text.match(new RegExp(enabledState.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'))).toHaveLength(1);
        expect(conflictFragment?.text.match(new RegExp(disabledState.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'))).toHaveLength(1);
    });

    test('finds remote state conflicts from the full selected documents beyond matched opening spans', async () => {
        const nominalOpening = 'Nominal state full scan source is the scoped comparison document for full-document state augmentation.';
        const fieldOpening = 'Field state full scan source is the scoped comparison document for full-document state augmentation.';
        const nominalState = 'The migration gate status is enabled in the remote nominal state appendix.';
        const fieldState = 'The migration gate status is disabled in the remote field state appendix.';
        const nominalDocument = [
            '# Nominal State Full Scan Source',
            nominalOpening,
            '',
            'This opening section is intentionally separate from the remote state statement.',
            '',
            'Local state filler paragraph one keeps the remote appendix away from the matched opening span.',
            '',
            'Local state filler paragraph two keeps the remote appendix away from the matched opening span.',
            '',
            'Local state filler paragraph three keeps the remote appendix away from the matched opening span.',
            '',
            'Local state filler paragraph four keeps the remote appendix away from the matched opening span.',
            '',
            'Local state filler paragraph five keeps the remote appendix away from the matched opening span.',
            '',
            'Local state filler paragraph six keeps the remote appendix away from the matched opening span.',
            '',
            '## Remote Nominal State Appendix',
            nominalState,
        ].join('\n');
        const fieldDocument = [
            '# Field State Full Scan Source',
            fieldOpening,
            '',
            'This opening section is intentionally separate from the remote state statement.',
            '',
            'Local state filler paragraph one keeps the remote appendix away from the matched opening span.',
            '',
            'Local state filler paragraph two keeps the remote appendix away from the matched opening span.',
            '',
            'Local state filler paragraph three keeps the remote appendix away from the matched opening span.',
            '',
            'Local state filler paragraph four keeps the remote appendix away from the matched opening span.',
            '',
            'Local state filler paragraph five keeps the remote appendix away from the matched opening span.',
            '',
            'Local state filler paragraph six keeps the remote appendix away from the matched opening span.',
            '',
            '## Remote Field State Appendix',
            fieldState,
        ].join('\n');
        const nominalAtom = makeAtom({
            id: 'atom_nominal_state_full_scan_source',
            documentId: 'doc_nominal_state_full_scan_source',
            sourcePath: 'Knowledge_Base/ragstatefullscan/nominal state full scan source.md',
            title: 'Nominal State Full Scan Source',
            content: nominalOpening,
            keywords: ['state', 'status', 'full scan'],
        });
        const fieldAtom = makeAtom({
            id: 'atom_field_state_full_scan_source',
            documentId: 'doc_field_state_full_scan_source',
            sourcePath: 'Knowledge_Base/ragstatefullscan/field state full scan source.md',
            title: 'Field State Full Scan Source',
            content: fieldOpening,
            keywords: ['state', 'status', 'full scan'],
        });
        const items: KnowledgeQueryItem[] = [
            {
                ...makeQueryItem({ atom: nominalAtom }),
                atom: nominalAtom,
                evidenceSpans: [
                    makeEvidenceSpan({
                        id: 'evidence_nominal_state_opening',
                        documentId: nominalAtom.documentId,
                        sourcePath: nominalAtom.sourcePath,
                        startOffset: nominalDocument.indexOf(nominalOpening),
                        endOffset: nominalDocument.indexOf(nominalOpening) + nominalOpening.length,
                        startLine: 2,
                        endLine: 2,
                        snippet: nominalOpening,
                    }),
                ],
            },
            {
                ...makeQueryItem({ atom: fieldAtom }),
                atom: fieldAtom,
                evidenceSpans: [
                    makeEvidenceSpan({
                        id: 'evidence_field_state_opening',
                        documentId: fieldAtom.documentId,
                        sourcePath: fieldAtom.sourcePath,
                        startOffset: fieldDocument.indexOf(fieldOpening),
                        endOffset: fieldDocument.indexOf(fieldOpening) + fieldOpening.length,
                        startLine: 2,
                        endLine: 2,
                        snippet: fieldOpening,
                    }),
                ],
            },
        ];
        const documentsById = new Map([
            [nominalAtom.documentId, nominalDocument],
            [fieldAtom.documentId, fieldDocument],
        ]);

        const assembly = await assembleRagEvidenceContext({
            query: 'compare nominal state full scan source with field state full scan source',
            items,
            sourceResolver: async (request) => ({
                documentId: request.documentId,
                sourcePath: request.sourcePath,
                content: documentsById.get(request.documentId) || '',
            }),
            paragraphWindow: 1,
            budget: {
                maxFragments: 8,
                maxCharsPerFragment: 900,
                maxTotalChars: 3000,
            },
        });

        const directSupportText = assembly.fragments
            .filter((fragment) => fragment.role === 'direct_support')
            .map((fragment) => fragment.text)
            .join('\n');
        expect(directSupportText).not.toContain('status is enabled');
        expect(directSupportText).not.toContain('status is disabled');

        const conflictFragment = assembly.fragments.find((fragment) => fragment.role === 'conflict');
        expect(conflictFragment).toEqual(expect.objectContaining({
            sourceBoundary: 'full_document',
            citationIds: expect.arrayContaining([
                'evidence_nominal_state_opening',
                'evidence_field_state_opening',
            ]),
        }));
        expect(conflictFragment?.text).toContain(nominalState);
        expect(conflictFragment?.text).toContain(fieldState);
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

    test('marks unitless quantity facts in the same section as conflicting evidence', async () => {
        const checklistLimit = 'The retry limit is 3 in the release checklist.';
        const appendixLimit = 'The retry limit is 5 in the rollback appendix.';
        const fullDocument = [
            '# Quantity Limit Conflict Probe',
            '',
            'Quantity limit conflict probe validates that unitless operational limits are not flattened into one stable value.',
            '',
            '## Retry Limit',
            checklistLimit,
            '',
            'Operators must inspect both operational records before publishing the limit.',
            '',
            appendixLimit,
            'Operators must resolve which retry limit is active before release.',
        ].join('\n');
        const atom = makeAtom({
            id: 'atom_conflicting_quantity_limit',
            documentId: 'doc_conflicting_quantity_limit',
            sourcePath: 'Knowledge_Base/ragquantityconflict/quantity limit conflict probe.md',
            title: 'Quantity Limit Conflict Probe',
            content: checklistLimit,
            keywords: ['quantity', 'limit', 'conflict'],
        });
        const item: KnowledgeQueryItem = {
            ...makeQueryItem({ atom }),
            atom,
            evidenceSpans: [
                makeEvidenceSpan({
                    id: 'evidence_checklist_retry_limit',
                    documentId: atom.documentId,
                    sourcePath: atom.sourcePath,
                    startOffset: fullDocument.indexOf(checklistLimit),
                    endOffset: fullDocument.indexOf(checklistLimit) + checklistLimit.length,
                    startLine: 6,
                    endLine: 6,
                    snippet: checklistLimit,
                }),
                makeEvidenceSpan({
                    id: 'evidence_appendix_retry_limit',
                    documentId: atom.documentId,
                    sourcePath: atom.sourcePath,
                    startOffset: fullDocument.indexOf(appendixLimit),
                    endOffset: fullDocument.indexOf(appendixLimit) + appendixLimit.length,
                    startLine: 10,
                    endLine: 10,
                    snippet: appendixLimit,
                }),
            ],
        };

        const assembly = await assembleRagEvidenceContext({
            query: 'what is quantity limit conflict probe?',
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
                'evidence_checklist_retry_limit',
                'evidence_appendix_retry_limit',
            ]),
            startLine: 6,
            endLine: 11,
        }));
        expect(conflictFragment?.text).toContain(checklistLimit);
        expect(conflictFragment?.text).toContain(appendixLimit);
        expect(conflictFragment?.text.match(new RegExp(checklistLimit.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'))).toHaveLength(1);
        expect(conflictFragment?.text.match(new RegExp(appendixLimit.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'))).toHaveLength(1);
    });

    test('finds remote unitless quantity conflicts from the full selected documents beyond matched opening spans', async () => {
        const nominalOpening = 'Nominal quantity full scan source is the scoped comparison document for full-document quantity augmentation.';
        const fieldOpening = 'Field quantity full scan source is the scoped comparison document for full-document quantity augmentation.';
        const nominalLimit = 'The retry limit is 3 in the remote nominal quantity appendix.';
        const fieldLimit = 'The retry limit is 5 in the remote field quantity appendix.';
        const nominalDocument = [
            '# Nominal Quantity Full Scan Source',
            nominalOpening,
            '',
            'This opening section is intentionally separate from the remote quantity statement.',
            '',
            'Local quantity filler paragraph one keeps the remote appendix away from the matched opening span.',
            '',
            'Local quantity filler paragraph two keeps the remote appendix away from the matched opening span.',
            '',
            'Local quantity filler paragraph three keeps the remote appendix away from the matched opening span.',
            '',
            'Local quantity filler paragraph four keeps the remote appendix away from the matched opening span.',
            '',
            'Local quantity filler paragraph five keeps the remote appendix away from the matched opening span.',
            '',
            'Local quantity filler paragraph six keeps the remote appendix away from the matched opening span.',
            '',
            '## Remote Nominal Quantity Appendix',
            nominalLimit,
        ].join('\n');
        const fieldDocument = [
            '# Field Quantity Full Scan Source',
            fieldOpening,
            '',
            'This opening section is intentionally separate from the remote quantity statement.',
            '',
            'Local quantity filler paragraph one keeps the remote appendix away from the matched opening span.',
            '',
            'Local quantity filler paragraph two keeps the remote appendix away from the matched opening span.',
            '',
            'Local quantity filler paragraph three keeps the remote appendix away from the matched opening span.',
            '',
            'Local quantity filler paragraph four keeps the remote appendix away from the matched opening span.',
            '',
            'Local quantity filler paragraph five keeps the remote appendix away from the matched opening span.',
            '',
            'Local quantity filler paragraph six keeps the remote appendix away from the matched opening span.',
            '',
            '## Remote Field Quantity Appendix',
            fieldLimit,
        ].join('\n');
        const nominalAtom = makeAtom({
            id: 'atom_nominal_quantity_full_scan_source',
            documentId: 'doc_nominal_quantity_full_scan_source',
            sourcePath: 'Knowledge_Base/ragquantityfullscan/nominal quantity full scan source.md',
            title: 'Nominal Quantity Full Scan Source',
            content: nominalOpening,
            keywords: ['quantity', 'limit', 'full scan'],
        });
        const fieldAtom = makeAtom({
            id: 'atom_field_quantity_full_scan_source',
            documentId: 'doc_field_quantity_full_scan_source',
            sourcePath: 'Knowledge_Base/ragquantityfullscan/field quantity full scan source.md',
            title: 'Field Quantity Full Scan Source',
            content: fieldOpening,
            keywords: ['quantity', 'limit', 'full scan'],
        });
        const items: KnowledgeQueryItem[] = [
            {
                ...makeQueryItem({ atom: nominalAtom }),
                atom: nominalAtom,
                evidenceSpans: [
                    makeEvidenceSpan({
                        id: 'evidence_nominal_quantity_opening',
                        documentId: nominalAtom.documentId,
                        sourcePath: nominalAtom.sourcePath,
                        startOffset: nominalDocument.indexOf(nominalOpening),
                        endOffset: nominalDocument.indexOf(nominalOpening) + nominalOpening.length,
                        startLine: 2,
                        endLine: 2,
                        snippet: nominalOpening,
                    }),
                ],
            },
            {
                ...makeQueryItem({ atom: fieldAtom }),
                atom: fieldAtom,
                evidenceSpans: [
                    makeEvidenceSpan({
                        id: 'evidence_field_quantity_opening',
                        documentId: fieldAtom.documentId,
                        sourcePath: fieldAtom.sourcePath,
                        startOffset: fieldDocument.indexOf(fieldOpening),
                        endOffset: fieldDocument.indexOf(fieldOpening) + fieldOpening.length,
                        startLine: 2,
                        endLine: 2,
                        snippet: fieldOpening,
                    }),
                ],
            },
        ];
        const documentsById = new Map([
            [nominalAtom.documentId, nominalDocument],
            [fieldAtom.documentId, fieldDocument],
        ]);

        const assembly = await assembleRagEvidenceContext({
            query: 'compare nominal quantity full scan source with field quantity full scan source',
            items,
            sourceResolver: async (request) => ({
                documentId: request.documentId,
                sourcePath: request.sourcePath,
                content: documentsById.get(request.documentId) || '',
            }),
            paragraphWindow: 1,
            budget: {
                maxFragments: 8,
                maxCharsPerFragment: 900,
                maxTotalChars: 3000,
            },
        });

        const directSupportText = assembly.fragments
            .filter((fragment) => fragment.role === 'direct_support')
            .map((fragment) => fragment.text)
            .join('\n');
        expect(directSupportText).not.toContain('retry limit is 3');
        expect(directSupportText).not.toContain('retry limit is 5');

        const conflictFragment = assembly.fragments.find((fragment) => fragment.role === 'conflict');
        expect(conflictFragment).toEqual(expect.objectContaining({
            sourceBoundary: 'full_document',
            citationIds: expect.arrayContaining([
                'evidence_nominal_quantity_opening',
                'evidence_field_quantity_opening',
            ]),
        }));
        expect(conflictFragment?.text).toContain(nominalLimit);
        expect(conflictFragment?.text).toContain(fieldLimit);
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

    test('does not mark environment-scoped quantity facts as conflicting evidence', async () => {
        const stagingLimit = 'The retry limit is 3 in the staging environment.';
        const productionLimit = 'The retry limit is 5 in the production environment.';
        const fullDocument = [
            '# Environment Scoped Retry Limit Probe',
            '',
            'Environment scoped retry limit probe validates that deployment-environment quantity values stay condition-qualified.',
            '',
            '## Retry Limit By Environment',
            stagingLimit,
            '',
            'Operators should preserve the environment label when comparing retry records.',
            '',
            productionLimit,
        ].join('\n');
        const atom = makeAtom({
            id: 'atom_environment_scoped_retry_limit',
            documentId: 'doc_environment_scoped_retry_limit',
            sourcePath: 'Knowledge_Base/ragenvironmentqualifier/environment scoped retry limit probe.md',
            title: 'Environment Scoped Retry Limit Probe',
            content: stagingLimit,
            keywords: ['environment', 'quantity', 'retry', 'limit'],
        });
        const item: KnowledgeQueryItem = {
            ...makeQueryItem({ atom }),
            atom,
            evidenceSpans: [
                makeEvidenceSpan({
                    id: 'evidence_staging_retry_limit',
                    documentId: atom.documentId,
                    sourcePath: atom.sourcePath,
                    startOffset: fullDocument.indexOf(stagingLimit),
                    endOffset: fullDocument.indexOf(stagingLimit) + stagingLimit.length,
                    startLine: 6,
                    endLine: 6,
                    snippet: stagingLimit,
                }),
                makeEvidenceSpan({
                    id: 'evidence_production_retry_limit',
                    documentId: atom.documentId,
                    sourcePath: atom.sourcePath,
                    startOffset: fullDocument.indexOf(productionLimit),
                    endOffset: fullDocument.indexOf(productionLimit) + productionLimit.length,
                    startLine: 10,
                    endLine: 10,
                    snippet: productionLimit,
                }),
            ],
        };

        const assembly = await assembleRagEvidenceContext({
            query: 'what is environment scoped retry limit probe?',
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

        expect(assembly.fragments.some((fragment) => fragment.role === 'conflict')).toBe(false);
        expect(assembly.fragments).toEqual(expect.arrayContaining([
            expect.objectContaining({
                role: 'parent_context',
                documentId: atom.documentId,
                sourceBoundary: 'full_document',
                text: expect.stringContaining(stagingLimit),
            }),
        ]));
        expect(assembly.fragments.map((fragment) => fragment.text).join('\n')).toContain(productionLimit);
    });

    test('marks controlled ownership identity facts in the same section as conflicting evidence', async () => {
        const handoffOwner = 'The deployment owner is Release Ops in the handoff sheet.';
        const rollbackOwner = 'The deployment owner is Rollback Team in the rollback appendix.';
        const fullDocument = [
            '# Ownership Conflict Probe',
            '',
            'Ownership conflict probe validates that controlled responsibility records are not flattened into one stable owner.',
            '',
            '## Deployment Ownership',
            handoffOwner,
            '',
            'Operators must inspect both ownership records before publishing the responsible team.',
            '',
            rollbackOwner,
            'Operators must resolve which deployment owner is active before release.',
        ].join('\n');
        const atom = makeAtom({
            id: 'atom_conflicting_ownership',
            documentId: 'doc_conflicting_ownership',
            sourcePath: 'Knowledge_Base/ragidentityconflict/ownership conflict probe.md',
            title: 'Ownership Conflict Probe',
            content: handoffOwner,
            keywords: ['ownership', 'owner', 'conflict'],
        });
        const item: KnowledgeQueryItem = {
            ...makeQueryItem({ atom }),
            atom,
            evidenceSpans: [
                makeEvidenceSpan({
                    id: 'evidence_handoff_deployment_owner',
                    documentId: atom.documentId,
                    sourcePath: atom.sourcePath,
                    startOffset: fullDocument.indexOf(handoffOwner),
                    endOffset: fullDocument.indexOf(handoffOwner) + handoffOwner.length,
                    startLine: 6,
                    endLine: 6,
                    snippet: handoffOwner,
                }),
                makeEvidenceSpan({
                    id: 'evidence_rollback_deployment_owner',
                    documentId: atom.documentId,
                    sourcePath: atom.sourcePath,
                    startOffset: fullDocument.indexOf(rollbackOwner),
                    endOffset: fullDocument.indexOf(rollbackOwner) + rollbackOwner.length,
                    startLine: 10,
                    endLine: 10,
                    snippet: rollbackOwner,
                }),
            ],
        };

        const assembly = await assembleRagEvidenceContext({
            query: 'what is ownership conflict probe?',
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
                'evidence_handoff_deployment_owner',
                'evidence_rollback_deployment_owner',
            ]),
            startLine: 6,
            endLine: 11,
        }));
        expect(conflictFragment?.text).toContain(handoffOwner);
        expect(conflictFragment?.text).toContain(rollbackOwner);
        expect(conflictFragment?.text.match(new RegExp(handoffOwner.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'))).toHaveLength(1);
        expect(conflictFragment?.text.match(new RegExp(rollbackOwner.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'))).toHaveLength(1);
    });

    test('marks controlled ownership identity facts from different documents as conflicting evidence', async () => {
        const handoffOwner = 'The deployment owner is Release Ops in the handoff owner record.';
        const rollbackOwner = 'The deployment owner is Rollback Team in the rollback owner record.';
        const handoffDocument = [
            '# Handoff Deployment Owner Conflict Probe',
            '',
            'Handoff deployment owner conflict probe provides the handoff-side owner record.',
            '',
            '## Handoff Owner Source',
            handoffOwner,
            'Operators must compare this owner source against rollback evidence before publishing a deployment owner.',
        ].join('\n');
        const rollbackDocument = [
            '# Rollback Deployment Owner Conflict Evidence',
            '',
            'Rollback deployment owner conflict evidence provides the rollback-side owner record.',
            '',
            '## Rollback Owner Source',
            rollbackOwner,
            'Operators must resolve the active owner source before publishing a stable deployment owner.',
        ].join('\n');
        const handoffAtom = makeAtom({
            id: 'atom_handoff_deployment_owner_conflict',
            documentId: 'doc_handoff_deployment_owner_conflict',
            sourcePath: 'Knowledge_Base/ragidentitymulticonflict/handoff deployment owner conflict probe.md',
            title: 'Handoff Deployment Owner Conflict Probe',
            content: handoffOwner,
            keywords: ['deployment', 'owner', 'handoff'],
        });
        const rollbackAtom = makeAtom({
            id: 'atom_rollback_deployment_owner_conflict',
            documentId: 'doc_rollback_deployment_owner_conflict',
            sourcePath: 'Knowledge_Base/ragidentitymulticonflict/rollback deployment owner conflict evidence.md',
            title: 'Rollback Deployment Owner Conflict Evidence',
            content: rollbackOwner,
            keywords: ['deployment', 'owner', 'rollback'],
        });
        const handoffItem = makeQueryItem({
            atom: handoffAtom,
            evidence: {
                id: 'evidence_handoff_deployment_owner_cross_document',
                documentId: handoffAtom.documentId,
                sourcePath: handoffAtom.sourcePath,
                startOffset: handoffDocument.indexOf(handoffOwner),
                endOffset: handoffDocument.indexOf(handoffOwner) + handoffOwner.length,
                startLine: 6,
                endLine: 6,
                snippet: handoffOwner,
            },
        });
        const rollbackItem = makeQueryItem({
            atom: rollbackAtom,
            evidence: {
                id: 'evidence_rollback_deployment_owner_cross_document',
                documentId: rollbackAtom.documentId,
                sourcePath: rollbackAtom.sourcePath,
                startOffset: rollbackDocument.indexOf(rollbackOwner),
                endOffset: rollbackDocument.indexOf(rollbackOwner) + rollbackOwner.length,
                startLine: 6,
                endLine: 6,
                snippet: rollbackOwner,
            },
        });

        const assembly = await assembleRagEvidenceContext({
            query: 'compare handoff deployment owner conflict probe with rollback deployment owner conflict evidence',
            items: [handoffItem, rollbackItem],
            sourceResolver: async (lookup) => ({
                documentId: lookup.documentId,
                sourcePath: lookup.sourcePath,
                content: lookup.documentId === handoffAtom.documentId ? handoffDocument : rollbackDocument,
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
                'evidence_handoff_deployment_owner_cross_document',
                'evidence_rollback_deployment_owner_cross_document',
            ]),
            text: expect.stringContaining('across documents'),
        }));
        expect(conflictFragment?.text).toContain('Handoff Deployment Owner Conflict Probe');
        expect(conflictFragment?.text).toContain('Rollback Deployment Owner Conflict Evidence');
        expect(conflictFragment?.text).toContain(handoffOwner);
        expect(conflictFragment?.text).toContain(rollbackOwner);
    });

    test('finds remote ownership identity conflicts from the full selected documents beyond matched opening spans', async () => {
        const nominalOpening = 'Nominal owner full scan source is the scoped comparison document for full-document ownership augmentation.';
        const fieldOpening = 'Field owner full scan source is the scoped comparison document for full-document ownership augmentation.';
        const releaseOwner = 'The deployment owner is Release Ops in the remote nominal owner appendix.';
        const rollbackOwner = 'The deployment owner is Rollback Team in the remote field owner appendix.';
        const nominalDocument = [
            '# Nominal Owner Full Scan Source',
            nominalOpening,
            '',
            'This opening section is intentionally separate from the remote owner statement.',
            '',
            'Local owner filler paragraph one keeps the remote appendix away from the matched opening span.',
            '',
            'Local owner filler paragraph two keeps the remote appendix away from the matched opening span.',
            '',
            'Local owner filler paragraph three keeps the remote appendix away from the matched opening span.',
            '',
            'Local owner filler paragraph four keeps the remote appendix away from the matched opening span.',
            '',
            'Local owner filler paragraph five keeps the remote appendix away from the matched opening span.',
            '',
            'Local owner filler paragraph six keeps the remote appendix away from the matched opening span.',
            '',
            '## Remote Nominal Owner Appendix',
            releaseOwner,
        ].join('\n');
        const fieldDocument = [
            '# Field Owner Full Scan Source',
            fieldOpening,
            '',
            'This opening section is intentionally separate from the remote owner statement.',
            '',
            'Local owner filler paragraph one keeps the remote appendix away from the matched opening span.',
            '',
            'Local owner filler paragraph two keeps the remote appendix away from the matched opening span.',
            '',
            'Local owner filler paragraph three keeps the remote appendix away from the matched opening span.',
            '',
            'Local owner filler paragraph four keeps the remote appendix away from the matched opening span.',
            '',
            'Local owner filler paragraph five keeps the remote appendix away from the matched opening span.',
            '',
            'Local owner filler paragraph six keeps the remote appendix away from the matched opening span.',
            '',
            '## Remote Field Owner Appendix',
            rollbackOwner,
        ].join('\n');
        const nominalAtom = makeAtom({
            id: 'atom_nominal_owner_full_scan_source',
            documentId: 'doc_nominal_owner_full_scan_source',
            sourcePath: 'Knowledge_Base/ragidentityfullscan/nominal owner full scan source.md',
            title: 'Nominal Owner Full Scan Source',
            content: nominalOpening,
            keywords: ['owner', 'ownership', 'full scan'],
        });
        const fieldAtom = makeAtom({
            id: 'atom_field_owner_full_scan_source',
            documentId: 'doc_field_owner_full_scan_source',
            sourcePath: 'Knowledge_Base/ragidentityfullscan/field owner full scan source.md',
            title: 'Field Owner Full Scan Source',
            content: fieldOpening,
            keywords: ['owner', 'ownership', 'full scan'],
        });
        const items: KnowledgeQueryItem[] = [
            {
                ...makeQueryItem({ atom: nominalAtom }),
                atom: nominalAtom,
                evidenceSpans: [
                    makeEvidenceSpan({
                        id: 'evidence_nominal_owner_opening',
                        documentId: nominalAtom.documentId,
                        sourcePath: nominalAtom.sourcePath,
                        startOffset: nominalDocument.indexOf(nominalOpening),
                        endOffset: nominalDocument.indexOf(nominalOpening) + nominalOpening.length,
                        startLine: 2,
                        endLine: 2,
                        snippet: nominalOpening,
                    }),
                ],
            },
            {
                ...makeQueryItem({ atom: fieldAtom }),
                atom: fieldAtom,
                evidenceSpans: [
                    makeEvidenceSpan({
                        id: 'evidence_field_owner_opening',
                        documentId: fieldAtom.documentId,
                        sourcePath: fieldAtom.sourcePath,
                        startOffset: fieldDocument.indexOf(fieldOpening),
                        endOffset: fieldDocument.indexOf(fieldOpening) + fieldOpening.length,
                        startLine: 2,
                        endLine: 2,
                        snippet: fieldOpening,
                    }),
                ],
            },
        ];
        const documentsById = new Map([
            [nominalAtom.documentId, nominalDocument],
            [fieldAtom.documentId, fieldDocument],
        ]);

        const assembly = await assembleRagEvidenceContext({
            query: 'compare nominal owner full scan source with field owner full scan source',
            items,
            sourceResolver: async (request) => ({
                documentId: request.documentId,
                sourcePath: request.sourcePath,
                content: documentsById.get(request.documentId) || '',
            }),
            paragraphWindow: 1,
            budget: {
                maxFragments: 8,
                maxCharsPerFragment: 900,
                maxTotalChars: 3000,
            },
        });

        const directSupportText = assembly.fragments
            .filter((fragment) => fragment.role === 'direct_support')
            .map((fragment) => fragment.text)
            .join('\n');
        expect(directSupportText).not.toContain('Release Ops');
        expect(directSupportText).not.toContain('Rollback Team');

        const conflictFragment = assembly.fragments.find((fragment) => fragment.role === 'conflict');
        expect(conflictFragment).toEqual(expect.objectContaining({
            sourceBoundary: 'full_document',
            citationIds: expect.arrayContaining([
                'evidence_nominal_owner_opening',
                'evidence_field_owner_opening',
            ]),
        }));
        expect(conflictFragment?.text).toContain(releaseOwner);
        expect(conflictFragment?.text).toContain(rollbackOwner);
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

    test('marks location facts in the same section as conflicting evidence', async () => {
        const primaryLocation = 'The control module location is Rack A in the primary bay.';
        const fieldLocation = 'The control module location is Rack B in the field bay.';
        const fullDocument = [
            '# Location Conflict Probe',
            '',
            'Location conflict probe validates that controlled location contradictions are not flattened into one stable site.',
            '',
            '## Module Placement',
            primaryLocation,
            '',
            'Operators should verify which placement record is active before dispatch.',
            '',
            fieldLocation,
            'Operators must resolve the active placement record before publishing location guidance.',
        ].join('\n');
        const atom = makeAtom({
            id: 'atom_conflicting_location',
            documentId: 'doc_conflicting_location',
            sourcePath: 'Knowledge_Base/raglocationconflict/location conflict probe.md',
            title: 'Location Conflict Probe',
            content: primaryLocation,
            keywords: ['location', 'conflict', 'module'],
        });
        const item: KnowledgeQueryItem = {
            ...makeQueryItem({ atom }),
            atom,
            evidenceSpans: [
                makeEvidenceSpan({
                    id: 'evidence_primary_location',
                    documentId: atom.documentId,
                    sourcePath: atom.sourcePath,
                    startOffset: fullDocument.indexOf(primaryLocation),
                    endOffset: fullDocument.indexOf(primaryLocation) + primaryLocation.length,
                    startLine: 6,
                    endLine: 6,
                    snippet: primaryLocation,
                }),
                makeEvidenceSpan({
                    id: 'evidence_field_location',
                    documentId: atom.documentId,
                    sourcePath: atom.sourcePath,
                    startOffset: fullDocument.indexOf(fieldLocation),
                    endOffset: fullDocument.indexOf(fieldLocation) + fieldLocation.length,
                    startLine: 10,
                    endLine: 10,
                    snippet: fieldLocation,
                }),
            ],
        };

        const assembly = await assembleRagEvidenceContext({
            query: 'what is location conflict probe?',
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
                'evidence_primary_location',
                'evidence_field_location',
            ]),
            startLine: 6,
            endLine: 11,
        }));
        expect(conflictFragment?.text).toContain(primaryLocation);
        expect(conflictFragment?.text).toContain(fieldLocation);
        expect(conflictFragment?.text.match(new RegExp(primaryLocation.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'))).toHaveLength(1);
        expect(conflictFragment?.text.match(new RegExp(fieldLocation.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'))).toHaveLength(1);
    });

    test('finds remote location conflicts from the full selected documents beyond matched opening spans', async () => {
        const nominalOpening = 'Nominal location full scan source is the scoped comparison document for full-document location augmentation.';
        const fieldOpening = 'Field location full scan source is the scoped comparison document for full-document location augmentation.';
        const primaryLocation = 'The control module location is Rack A in the remote nominal location appendix.';
        const fieldLocation = 'The control module location is Rack B in the remote field location appendix.';
        const nominalDocument = [
            '# Nominal Location Full Scan Source',
            nominalOpening,
            '',
            'This opening section is intentionally separate from the remote location statement.',
            '',
            'Local location filler paragraph one keeps the remote appendix away from the matched opening span.',
            '',
            'Local location filler paragraph two keeps the remote appendix away from the matched opening span.',
            '',
            'Local location filler paragraph three keeps the remote appendix away from the matched opening span.',
            '',
            'Local location filler paragraph four keeps the remote appendix away from the matched opening span.',
            '',
            'Local location filler paragraph five keeps the remote appendix away from the matched opening span.',
            '',
            'Local location filler paragraph six keeps the remote appendix away from the matched opening span.',
            '',
            '## Remote Nominal Location Appendix',
            primaryLocation,
        ].join('\n');
        const fieldDocument = [
            '# Field Location Full Scan Source',
            fieldOpening,
            '',
            'This opening section is intentionally separate from the remote location statement.',
            '',
            'Local location filler paragraph one keeps the remote appendix away from the matched opening span.',
            '',
            'Local location filler paragraph two keeps the remote appendix away from the matched opening span.',
            '',
            'Local location filler paragraph three keeps the remote appendix away from the matched opening span.',
            '',
            'Local location filler paragraph four keeps the remote appendix away from the matched opening span.',
            '',
            'Local location filler paragraph five keeps the remote appendix away from the matched opening span.',
            '',
            'Local location filler paragraph six keeps the remote appendix away from the matched opening span.',
            '',
            '## Remote Field Location Appendix',
            fieldLocation,
        ].join('\n');
        const nominalAtom = makeAtom({
            id: 'atom_nominal_location_full_scan_source',
            documentId: 'doc_nominal_location_full_scan_source',
            sourcePath: 'Knowledge_Base/raglocationfullscan/nominal location full scan source.md',
            title: 'Nominal Location Full Scan Source',
            content: nominalOpening,
            keywords: ['location', 'placement', 'full scan'],
        });
        const fieldAtom = makeAtom({
            id: 'atom_field_location_full_scan_source',
            documentId: 'doc_field_location_full_scan_source',
            sourcePath: 'Knowledge_Base/raglocationfullscan/field location full scan source.md',
            title: 'Field Location Full Scan Source',
            content: fieldOpening,
            keywords: ['location', 'placement', 'full scan'],
        });
        const items: KnowledgeQueryItem[] = [
            {
                ...makeQueryItem({ atom: nominalAtom }),
                atom: nominalAtom,
                evidenceSpans: [
                    makeEvidenceSpan({
                        id: 'evidence_nominal_location_opening',
                        documentId: nominalAtom.documentId,
                        sourcePath: nominalAtom.sourcePath,
                        startOffset: nominalDocument.indexOf(nominalOpening),
                        endOffset: nominalDocument.indexOf(nominalOpening) + nominalOpening.length,
                        startLine: 2,
                        endLine: 2,
                        snippet: nominalOpening,
                    }),
                ],
            },
            {
                ...makeQueryItem({ atom: fieldAtom }),
                atom: fieldAtom,
                evidenceSpans: [
                    makeEvidenceSpan({
                        id: 'evidence_field_location_opening',
                        documentId: fieldAtom.documentId,
                        sourcePath: fieldAtom.sourcePath,
                        startOffset: fieldDocument.indexOf(fieldOpening),
                        endOffset: fieldDocument.indexOf(fieldOpening) + fieldOpening.length,
                        startLine: 2,
                        endLine: 2,
                        snippet: fieldOpening,
                    }),
                ],
            },
        ];
        const documentsById = new Map([
            [nominalAtom.documentId, nominalDocument],
            [fieldAtom.documentId, fieldDocument],
        ]);

        const assembly = await assembleRagEvidenceContext({
            query: 'compare nominal location full scan source with field location full scan source',
            items,
            sourceResolver: async (request) => ({
                documentId: request.documentId,
                sourcePath: request.sourcePath,
                content: documentsById.get(request.documentId) || '',
            }),
            paragraphWindow: 1,
            budget: {
                maxFragments: 8,
                maxCharsPerFragment: 900,
                maxTotalChars: 3000,
            },
        });

        const directSupportText = assembly.fragments
            .filter((fragment) => fragment.role === 'direct_support')
            .map((fragment) => fragment.text)
            .join('\n');
        expect(directSupportText).not.toContain('Rack A');
        expect(directSupportText).not.toContain('Rack B');

        const conflictFragment = assembly.fragments.find((fragment) => fragment.role === 'conflict');
        expect(conflictFragment).toEqual(expect.objectContaining({
            sourceBoundary: 'full_document',
            citationIds: expect.arrayContaining([
                'evidence_nominal_location_opening',
                'evidence_field_location_opening',
            ]),
        }));
        expect(conflictFragment?.text).toContain(primaryLocation);
        expect(conflictFragment?.text).toContain(fieldLocation);
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

    test('marks endpoint facts in the same section as conflicting evidence', async () => {
        const legacyEndpoint = 'The webhook endpoint is /api/v1/hooks.';
        const currentEndpoint = 'The webhook endpoint is /api/v2/hooks.';
        const fullDocument = [
            '# Endpoint Conflict Probe',
            '',
            'Endpoint conflict probe validates that route values are comparable operational facts.',
            '',
            '## Webhook Routing',
            legacyEndpoint,
            '',
            currentEndpoint,
            'Operators must resolve which webhook endpoint is active before release.',
        ].join('\n');
        const atom = makeAtom({
            id: 'atom_conflicting_endpoint',
            documentId: 'doc_conflicting_endpoint',
            sourcePath: 'Knowledge_Base/ragendpointconflict/endpoint conflict probe.md',
            title: 'Endpoint Conflict Probe',
            content: legacyEndpoint,
            keywords: ['endpoint', 'conflict', 'webhook'],
        });
        const item: KnowledgeQueryItem = {
            ...makeQueryItem({ atom }),
            atom,
            evidenceSpans: [
                makeEvidenceSpan({
                    id: 'evidence_legacy_endpoint',
                    documentId: atom.documentId,
                    sourcePath: atom.sourcePath,
                    startOffset: fullDocument.indexOf(legacyEndpoint),
                    endOffset: fullDocument.indexOf(legacyEndpoint) + legacyEndpoint.length,
                    startLine: 6,
                    endLine: 6,
                    snippet: legacyEndpoint,
                }),
                makeEvidenceSpan({
                    id: 'evidence_current_endpoint',
                    documentId: atom.documentId,
                    sourcePath: atom.sourcePath,
                    startOffset: fullDocument.indexOf(currentEndpoint),
                    endOffset: fullDocument.indexOf(currentEndpoint) + currentEndpoint.length,
                    startLine: 8,
                    endLine: 8,
                    snippet: currentEndpoint,
                }),
            ],
        };

        const assembly = await assembleRagEvidenceContext({
            query: 'what is endpoint conflict probe?',
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
                'evidence_legacy_endpoint',
                'evidence_current_endpoint',
            ]),
            startLine: 6,
            endLine: 9,
        }));
        expect(conflictFragment?.text).toContain(legacyEndpoint);
        expect(conflictFragment?.text).toContain(currentEndpoint);
    });

    test('finds remote endpoint conflicts from the full selected documents beyond matched opening spans', async () => {
        const nominalOpening = 'Nominal endpoint full scan source is the scoped comparison document for full-document endpoint augmentation.';
        const fieldOpening = 'Field endpoint full scan source is the scoped comparison document for full-document endpoint augmentation.';
        const legacyEndpoint = 'The webhook endpoint is /api/v1/hooks in the remote nominal endpoint appendix.';
        const currentEndpoint = 'The webhook endpoint is /api/v2/hooks in the remote field endpoint appendix.';
        const nominalDocument = [
            '# Nominal Endpoint Full Scan Source',
            nominalOpening,
            '',
            'This opening section is intentionally separate from the remote endpoint statement.',
            '',
            'Local endpoint filler paragraph one keeps the remote appendix away from the matched opening span.',
            '',
            'Local endpoint filler paragraph two keeps the remote appendix away from the matched opening span.',
            '',
            'Local endpoint filler paragraph three keeps the remote appendix away from the matched opening span.',
            '',
            'Local endpoint filler paragraph four keeps the remote appendix away from the matched opening span.',
            '',
            'Local endpoint filler paragraph five keeps the remote appendix away from the matched opening span.',
            '',
            'Local endpoint filler paragraph six keeps the remote appendix away from the matched opening span.',
            '',
            '## Remote Nominal Endpoint Appendix',
            legacyEndpoint,
        ].join('\n');
        const fieldDocument = [
            '# Field Endpoint Full Scan Source',
            fieldOpening,
            '',
            'This opening section is intentionally separate from the remote endpoint statement.',
            '',
            'Local endpoint filler paragraph one keeps the remote appendix away from the matched opening span.',
            '',
            'Local endpoint filler paragraph two keeps the remote appendix away from the matched opening span.',
            '',
            'Local endpoint filler paragraph three keeps the remote appendix away from the matched opening span.',
            '',
            'Local endpoint filler paragraph four keeps the remote appendix away from the matched opening span.',
            '',
            'Local endpoint filler paragraph five keeps the remote appendix away from the matched opening span.',
            '',
            'Local endpoint filler paragraph six keeps the remote appendix away from the matched opening span.',
            '',
            '## Remote Field Endpoint Appendix',
            currentEndpoint,
        ].join('\n');
        const nominalAtom = makeAtom({
            id: 'atom_nominal_endpoint_full_scan_source',
            documentId: 'doc_nominal_endpoint_full_scan_source',
            sourcePath: 'Knowledge_Base/ragendpointfullscan/nominal endpoint full scan source.md',
            title: 'Nominal Endpoint Full Scan Source',
            content: nominalOpening,
            keywords: ['endpoint', 'webhook', 'full scan'],
        });
        const fieldAtom = makeAtom({
            id: 'atom_field_endpoint_full_scan_source',
            documentId: 'doc_field_endpoint_full_scan_source',
            sourcePath: 'Knowledge_Base/ragendpointfullscan/field endpoint full scan source.md',
            title: 'Field Endpoint Full Scan Source',
            content: fieldOpening,
            keywords: ['endpoint', 'webhook', 'full scan'],
        });
        const items: KnowledgeQueryItem[] = [
            {
                ...makeQueryItem({ atom: nominalAtom }),
                atom: nominalAtom,
                evidenceSpans: [
                    makeEvidenceSpan({
                        id: 'evidence_nominal_endpoint_opening',
                        documentId: nominalAtom.documentId,
                        sourcePath: nominalAtom.sourcePath,
                        startOffset: nominalDocument.indexOf(nominalOpening),
                        endOffset: nominalDocument.indexOf(nominalOpening) + nominalOpening.length,
                        startLine: 2,
                        endLine: 2,
                        snippet: nominalOpening,
                    }),
                ],
            },
            {
                ...makeQueryItem({ atom: fieldAtom }),
                atom: fieldAtom,
                evidenceSpans: [
                    makeEvidenceSpan({
                        id: 'evidence_field_endpoint_opening',
                        documentId: fieldAtom.documentId,
                        sourcePath: fieldAtom.sourcePath,
                        startOffset: fieldDocument.indexOf(fieldOpening),
                        endOffset: fieldDocument.indexOf(fieldOpening) + fieldOpening.length,
                        startLine: 2,
                        endLine: 2,
                        snippet: fieldOpening,
                    }),
                ],
            },
        ];
        const documentsById = new Map([
            [nominalAtom.documentId, nominalDocument],
            [fieldAtom.documentId, fieldDocument],
        ]);

        const assembly = await assembleRagEvidenceContext({
            query: 'compare nominal endpoint full scan source with field endpoint full scan source',
            items,
            sourceResolver: async (request) => ({
                documentId: request.documentId,
                sourcePath: request.sourcePath,
                content: documentsById.get(request.documentId) || '',
            }),
            paragraphWindow: 1,
            budget: {
                maxFragments: 8,
                maxCharsPerFragment: 900,
                maxTotalChars: 3000,
            },
        });

        const directSupportText = assembly.fragments
            .filter((fragment) => fragment.role === 'direct_support')
            .map((fragment) => fragment.text)
            .join('\n');
        expect(directSupportText).not.toContain('/api/v1/hooks');
        expect(directSupportText).not.toContain('/api/v2/hooks');

        const conflictFragment = assembly.fragments.find((fragment) => fragment.role === 'conflict');
        expect(conflictFragment).toEqual(expect.objectContaining({
            sourceBoundary: 'full_document',
            citationIds: expect.arrayContaining([
                'evidence_nominal_endpoint_opening',
                'evidence_field_endpoint_opening',
            ]),
        }));
        expect(conflictFragment?.text).toContain(legacyEndpoint);
        expect(conflictFragment?.text).toContain(currentEndpoint);
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

    test('does not mark environment-scoped endpoint facts as conflicting evidence', async () => {
        const stagingEndpoint = 'The webhook endpoint is /api/staging/hooks in the staging environment.';
        const productionEndpoint = 'The webhook endpoint is /api/prod/hooks in the production environment.';
        const fullDocument = [
            '# Environment Scoped Endpoint Probe',
            '',
            'Environment scoped endpoint probe validates that deployment-environment route values stay condition-qualified.',
            '',
            '## Environment Routes',
            stagingEndpoint,
            '',
            productionEndpoint,
        ].join('\n');
        const atom = makeAtom({
            id: 'atom_environment_scoped_endpoint',
            documentId: 'doc_environment_scoped_endpoint',
            sourcePath: 'Knowledge_Base/ragendpointqualifier/environment scoped endpoint probe.md',
            title: 'Environment Scoped Endpoint Probe',
            content: stagingEndpoint,
            keywords: ['environment', 'endpoint', 'webhook'],
        });
        const item: KnowledgeQueryItem = {
            ...makeQueryItem({ atom }),
            atom,
            evidenceSpans: [
                makeEvidenceSpan({
                    id: 'evidence_staging_endpoint',
                    documentId: atom.documentId,
                    sourcePath: atom.sourcePath,
                    startOffset: fullDocument.indexOf(stagingEndpoint),
                    endOffset: fullDocument.indexOf(stagingEndpoint) + stagingEndpoint.length,
                    startLine: 6,
                    endLine: 6,
                    snippet: stagingEndpoint,
                }),
                makeEvidenceSpan({
                    id: 'evidence_production_endpoint',
                    documentId: atom.documentId,
                    sourcePath: atom.sourcePath,
                    startOffset: fullDocument.indexOf(productionEndpoint),
                    endOffset: fullDocument.indexOf(productionEndpoint) + productionEndpoint.length,
                    startLine: 8,
                    endLine: 8,
                    snippet: productionEndpoint,
                }),
            ],
        };

        const assembly = await assembleRagEvidenceContext({
            query: 'what is environment scoped endpoint probe?',
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

        expect(assembly.fragments.some((fragment) => fragment.role === 'conflict')).toBe(false);
        expect(assembly.fragments).toEqual(expect.arrayContaining([
            expect.objectContaining({
                role: 'parent_context',
                documentId: atom.documentId,
                sourceBoundary: 'full_document',
                text: expect.stringContaining(stagingEndpoint),
            }),
        ]));
        expect(assembly.fragments.map((fragment) => fragment.text).join('\n')).toContain(productionEndpoint);
    });

    test('marks dependency facts in the same section as conflicting evidence', async () => {
        const sqliteDependency = 'The storage dependency is SQLite in the release manifest.';
        const postgresDependency = 'The storage dependency is PostgreSQL in the rollback manifest.';
        const fullDocument = [
            '# Dependency Conflict Probe',
            '',
            'Dependency conflict probe validates that explicit dependency values are comparable operational facts.',
            '',
            '## Storage Dependency',
            sqliteDependency,
            '',
            postgresDependency,
        ].join('\n');
        const atom = makeAtom({
            id: 'atom_conflicting_dependency',
            documentId: 'doc_conflicting_dependency',
            sourcePath: 'Knowledge_Base/ragdependencyconflict/dependency conflict probe.md',
            title: 'Dependency Conflict Probe',
            content: sqliteDependency,
            keywords: ['dependency', 'conflict', 'storage'],
        });
        const item: KnowledgeQueryItem = {
            ...makeQueryItem({ atom }),
            atom,
            evidenceSpans: [
                makeEvidenceSpan({
                    id: 'evidence_sqlite_dependency',
                    documentId: atom.documentId,
                    sourcePath: atom.sourcePath,
                    startOffset: fullDocument.indexOf(sqliteDependency),
                    endOffset: fullDocument.indexOf(sqliteDependency) + sqliteDependency.length,
                    startLine: 6,
                    endLine: 6,
                    snippet: sqliteDependency,
                }),
                makeEvidenceSpan({
                    id: 'evidence_postgres_dependency',
                    documentId: atom.documentId,
                    sourcePath: atom.sourcePath,
                    startOffset: fullDocument.indexOf(postgresDependency),
                    endOffset: fullDocument.indexOf(postgresDependency) + postgresDependency.length,
                    startLine: 8,
                    endLine: 8,
                    snippet: postgresDependency,
                }),
            ],
        };

        const assembly = await assembleRagEvidenceContext({
            query: 'what is dependency conflict probe?',
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
                'evidence_sqlite_dependency',
                'evidence_postgres_dependency',
            ]),
            startLine: 6,
            endLine: 8,
        }));
        expect(conflictFragment?.text).toContain(sqliteDependency);
        expect(conflictFragment?.text).toContain(postgresDependency);
    });

    test('does not mark environment-scoped dependency facts as conflicting evidence', async () => {
        const stagingDependency = 'The storage dependency is SQLite in the staging environment.';
        const productionDependency = 'The storage dependency is PostgreSQL in the production environment.';
        const fullDocument = [
            '# Environment Scoped Dependency Probe',
            '',
            'Environment scoped dependency probe validates that deployment-environment dependency values stay condition-qualified.',
            '',
            '## Environment Dependencies',
            stagingDependency,
            '',
            productionDependency,
        ].join('\n');
        const atom = makeAtom({
            id: 'atom_environment_scoped_dependency',
            documentId: 'doc_environment_scoped_dependency',
            sourcePath: 'Knowledge_Base/ragdependencyqualifier/environment scoped dependency probe.md',
            title: 'Environment Scoped Dependency Probe',
            content: stagingDependency,
            keywords: ['environment', 'dependency', 'storage'],
        });
        const item: KnowledgeQueryItem = {
            ...makeQueryItem({ atom }),
            atom,
            evidenceSpans: [
                makeEvidenceSpan({
                    id: 'evidence_staging_dependency',
                    documentId: atom.documentId,
                    sourcePath: atom.sourcePath,
                    startOffset: fullDocument.indexOf(stagingDependency),
                    endOffset: fullDocument.indexOf(stagingDependency) + stagingDependency.length,
                    startLine: 6,
                    endLine: 6,
                    snippet: stagingDependency,
                }),
                makeEvidenceSpan({
                    id: 'evidence_production_dependency',
                    documentId: atom.documentId,
                    sourcePath: atom.sourcePath,
                    startOffset: fullDocument.indexOf(productionDependency),
                    endOffset: fullDocument.indexOf(productionDependency) + productionDependency.length,
                    startLine: 8,
                    endLine: 8,
                    snippet: productionDependency,
                }),
            ],
        };

        const assembly = await assembleRagEvidenceContext({
            query: 'what is environment scoped dependency probe?',
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

        expect(assembly.fragments.some((fragment) => fragment.role === 'conflict')).toBe(false);
        expect(assembly.fragments).toEqual(expect.arrayContaining([
            expect.objectContaining({
                role: 'parent_context',
                documentId: atom.documentId,
                sourceBoundary: 'full_document',
                text: expect.stringContaining(stagingDependency),
            }),
        ]));
        expect(assembly.fragments.map((fragment) => fragment.text).join('\n')).toContain(productionDependency);
    });

    test('marks dependency facts from different documents as conflicting evidence', async () => {
        const nominalDependency = 'The storage dependency is SQLite in the nominal deployment manifest.';
        const fieldDependency = 'The storage dependency is PostgreSQL in the field deployment manifest.';
        const nominalDocument = [
            '# Nominal Storage Dependency Conflict Probe',
            '',
            'Nominal storage dependency conflict probe records the nominal dependency source.',
            '',
            '## Nominal Dependency',
            nominalDependency,
        ].join('\n');
        const fieldDocument = [
            '# Field Storage Dependency Conflict Evidence',
            '',
            'Field storage dependency conflict evidence records the field dependency source.',
            '',
            '## Field Dependency',
            fieldDependency,
        ].join('\n');
        const nominalAtom = makeAtom({
            id: 'atom_nominal_dependency_conflict',
            documentId: 'doc_nominal_dependency_conflict',
            sourcePath: 'Knowledge_Base/ragdependencymulticonflict/nominal storage dependency conflict probe.md',
            title: 'Nominal Storage Dependency Conflict Probe',
            content: nominalDependency,
            keywords: ['dependency', 'storage', 'nominal'],
        });
        const fieldAtom = makeAtom({
            id: 'atom_field_dependency_conflict',
            documentId: 'doc_field_dependency_conflict',
            sourcePath: 'Knowledge_Base/ragdependencymulticonflict/field storage dependency conflict evidence.md',
            title: 'Field Storage Dependency Conflict Evidence',
            content: fieldDependency,
            keywords: ['dependency', 'storage', 'field'],
        });
        const nominalItem = makeQueryItem({
            atom: nominalAtom,
            evidence: {
                id: 'evidence_nominal_dependency',
                documentId: nominalAtom.documentId,
                sourcePath: nominalAtom.sourcePath,
                startOffset: nominalDocument.indexOf(nominalDependency),
                endOffset: nominalDocument.indexOf(nominalDependency) + nominalDependency.length,
                startLine: 6,
                endLine: 6,
                snippet: nominalDependency,
            },
        });
        const fieldItem = makeQueryItem({
            atom: fieldAtom,
            evidence: {
                id: 'evidence_field_dependency',
                documentId: fieldAtom.documentId,
                sourcePath: fieldAtom.sourcePath,
                startOffset: fieldDocument.indexOf(fieldDependency),
                endOffset: fieldDocument.indexOf(fieldDependency) + fieldDependency.length,
                startLine: 6,
                endLine: 6,
                snippet: fieldDependency,
            },
        });

        const assembly = await assembleRagEvidenceContext({
            query: 'compare nominal storage dependency conflict probe with field storage dependency conflict evidence',
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
                'evidence_nominal_dependency',
                'evidence_field_dependency',
            ]),
            text: expect.stringContaining('across documents'),
        }));
        expect(conflictFragment?.text).toContain(nominalDependency);
        expect(conflictFragment?.text).toContain(fieldDependency);
    });

    test('scans complete selected documents for dependency conflicts beyond the local context window', async () => {
        const nominalIntro = 'Nominal dependency full scan source introduces the deployment dependency comparison without listing the final dependency value.';
        const fieldIntro = 'Field dependency full scan source introduces the comparison evidence without listing the final dependency value.';
        const nominalDependency = 'The storage dependency is SQLite in the remote nominal dependency appendix.';
        const fieldDependency = 'The storage dependency is PostgreSQL in the remote field dependency appendix.';
        const filler = Array.from({ length: 8 }, (_, index) => `Dependency filler paragraph ${index + 1} keeps the appendix outside the local window.`);
        const nominalDocument = [
            '# Nominal Dependency Full Scan Source',
            '',
            nominalIntro,
            '',
            ...filler.flatMap((line) => [line, '']),
            '## Remote Nominal Dependency Appendix',
            nominalDependency,
        ].join('\n');
        const fieldDocument = [
            '# Field Dependency Full Scan Source',
            '',
            fieldIntro,
            '',
            ...filler.flatMap((line) => [line, '']),
            '## Remote Field Dependency Appendix',
            fieldDependency,
        ].join('\n');
        const nominalAtom = makeAtom({
            id: 'atom_nominal_dependency_full_scan_source',
            documentId: 'doc_nominal_dependency_full_scan_source',
            sourcePath: 'Knowledge_Base/ragdependencyfullscan/nominal dependency full scan source.md',
            title: 'Nominal Dependency Full Scan Source',
            content: nominalIntro,
            keywords: ['nominal', 'dependency', 'full', 'scan'],
        });
        const fieldAtom = makeAtom({
            id: 'atom_field_dependency_full_scan_source',
            documentId: 'doc_field_dependency_full_scan_source',
            sourcePath: 'Knowledge_Base/ragdependencyfullscan/field dependency full scan source.md',
            title: 'Field Dependency Full Scan Source',
            content: fieldIntro,
            keywords: ['field', 'dependency', 'full', 'scan'],
        });
        const nominalItem = makeQueryItem({
            atom: nominalAtom,
            evidence: {
                id: 'evidence_nominal_dependency_full_scan_intro',
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
                id: 'evidence_field_dependency_full_scan_intro',
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
            query: 'compare nominal dependency full scan source with field dependency full scan source',
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
                'evidence_nominal_dependency_full_scan_intro',
                'evidence_field_dependency_full_scan_intro',
            ]),
            text: expect.stringContaining('across documents'),
        }));
        expect(conflictFragment?.text).toContain(nominalDependency);
        expect(conflictFragment?.text).toContain(fieldDependency);
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

    test('does not mark version-scoped dependency facts as conflicting evidence', async () => {
        const versionOneDependency = 'The storage dependency is SQLite in version 1.0.';
        const versionTwoDependency = 'The storage dependency is PostgreSQL in version 2.0.';
        const fullDocument = [
            '# Version Scoped Dependency Probe',
            '',
            'Version scoped dependency probe validates that version-specific dependencies stay condition-qualified.',
            '',
            '## Version Dependencies',
            versionOneDependency,
            '',
            versionTwoDependency,
        ].join('\n');
        const atom = makeAtom({
            id: 'atom_version_scoped_dependency',
            documentId: 'doc_version_scoped_dependency',
            sourcePath: 'Knowledge_Base/ragdependencyversionqualifier/version scoped dependency probe.md',
            title: 'Version Scoped Dependency Probe',
            content: versionOneDependency,
            keywords: ['version', 'dependency', 'storage'],
        });
        const item: KnowledgeQueryItem = {
            ...makeQueryItem({ atom }),
            atom,
            evidenceSpans: [
                makeEvidenceSpan({
                    id: 'evidence_version_one_dependency',
                    documentId: atom.documentId,
                    sourcePath: atom.sourcePath,
                    startOffset: fullDocument.indexOf(versionOneDependency),
                    endOffset: fullDocument.indexOf(versionOneDependency) + versionOneDependency.length,
                    startLine: 6,
                    endLine: 6,
                    snippet: versionOneDependency,
                }),
                makeEvidenceSpan({
                    id: 'evidence_version_two_dependency',
                    documentId: atom.documentId,
                    sourcePath: atom.sourcePath,
                    startOffset: fullDocument.indexOf(versionTwoDependency),
                    endOffset: fullDocument.indexOf(versionTwoDependency) + versionTwoDependency.length,
                    startLine: 8,
                    endLine: 8,
                    snippet: versionTwoDependency,
                }),
            ],
        };

        const assembly = await assembleRagEvidenceContext({
            query: 'what is version scoped dependency probe?',
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

        expect(assembly.fragments.some((fragment) => fragment.role === 'conflict')).toBe(false);
        expect(assembly.fragments).toEqual(expect.arrayContaining([
            expect.objectContaining({
                role: 'parent_context',
                documentId: atom.documentId,
                sourceBoundary: 'full_document',
                text: expect.stringContaining(versionOneDependency),
            }),
        ]));
        expect(assembly.fragments.map((fragment) => fragment.text).join('\n')).toContain(versionTwoDependency);
    });

    test('marks format facts in the same section as conflicting evidence', async () => {
        const jsonFormat = 'The payload format is JSON in the release contract.';
        const yamlFormat = 'The payload format is YAML in the rollback contract.';
        const fullDocument = [
            '# Format Conflict Probe',
            '',
            'Format conflict probe validates that explicit serialization formats are comparable operational facts.',
            '',
            '## Payload Contract',
            jsonFormat,
            '',
            'Context paragraph keeps the format conflict inside one scoped section.',
            '',
            yamlFormat,
        ].join('\n');
        const atom = makeAtom({
            id: 'atom_conflicting_format',
            documentId: 'doc_conflicting_format',
            sourcePath: 'Knowledge_Base/ragformatconflict/format conflict probe.md',
            title: 'Format Conflict Probe',
            content: jsonFormat,
            keywords: ['format', 'payload', 'serialization'],
        });
        const item: KnowledgeQueryItem = {
            ...makeQueryItem({ atom }),
            atom,
            evidenceSpans: [
                makeEvidenceSpan({
                    id: 'evidence_json_format',
                    documentId: atom.documentId,
                    sourcePath: atom.sourcePath,
                    startOffset: fullDocument.indexOf(jsonFormat),
                    endOffset: fullDocument.indexOf(jsonFormat) + jsonFormat.length,
                    startLine: 6,
                    endLine: 6,
                    snippet: jsonFormat,
                }),
                makeEvidenceSpan({
                    id: 'evidence_yaml_format',
                    documentId: atom.documentId,
                    sourcePath: atom.sourcePath,
                    startOffset: fullDocument.indexOf(yamlFormat),
                    endOffset: fullDocument.indexOf(yamlFormat) + yamlFormat.length,
                    startLine: 10,
                    endLine: 10,
                    snippet: yamlFormat,
                }),
            ],
        };

        const assembly = await assembleRagEvidenceContext({
            query: 'what is format conflict probe?',
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
            sourceBoundary: 'full_document',
            citationIds: expect.arrayContaining([
                'evidence_json_format',
                'evidence_yaml_format',
            ]),
        }));
        expect(conflictFragment?.text).toContain(jsonFormat);
        expect(conflictFragment?.text).toContain(yamlFormat);
    });

    test('finds remote format conflicts from the full selected documents beyond matched opening spans', async () => {
        const nominalOpening = 'Nominal format full scan source is the scoped comparison document for full-document format augmentation.';
        const fieldOpening = 'Field format full scan source is the scoped comparison document for full-document format augmentation.';
        const jsonFormat = 'The payload format is JSON in the remote nominal format appendix.';
        const yamlFormat = 'The payload format is YAML in the remote field format appendix.';
        const nominalDocument = [
            '# Nominal Format Full Scan Source',
            nominalOpening,
            '',
            'This opening section is intentionally separate from the remote format statement.',
            '',
            'Local format filler paragraph one keeps the remote appendix away from the matched opening span.',
            '',
            'Local format filler paragraph two keeps the remote appendix away from the matched opening span.',
            '',
            'Local format filler paragraph three keeps the remote appendix away from the matched opening span.',
            '',
            'Local format filler paragraph four keeps the remote appendix away from the matched opening span.',
            '',
            'Local format filler paragraph five keeps the remote appendix away from the matched opening span.',
            '',
            'Local format filler paragraph six keeps the remote appendix away from the matched opening span.',
            '',
            '## Remote Nominal Format Appendix',
            jsonFormat,
        ].join('\n');
        const fieldDocument = [
            '# Field Format Full Scan Source',
            fieldOpening,
            '',
            'This opening section is intentionally separate from the remote format statement.',
            '',
            'Local format filler paragraph one keeps the remote appendix away from the matched opening span.',
            '',
            'Local format filler paragraph two keeps the remote appendix away from the matched opening span.',
            '',
            'Local format filler paragraph three keeps the remote appendix away from the matched opening span.',
            '',
            'Local format filler paragraph four keeps the remote appendix away from the matched opening span.',
            '',
            'Local format filler paragraph five keeps the remote appendix away from the matched opening span.',
            '',
            'Local format filler paragraph six keeps the remote appendix away from the matched opening span.',
            '',
            '## Remote Field Format Appendix',
            yamlFormat,
        ].join('\n');
        const nominalAtom = makeAtom({
            id: 'atom_nominal_format_full_scan_source',
            documentId: 'doc_nominal_format_full_scan_source',
            sourcePath: 'Knowledge_Base/ragformatfullscan/nominal format full scan source.md',
            title: 'Nominal Format Full Scan Source',
            content: nominalOpening,
            keywords: ['format', 'payload', 'full scan'],
        });
        const fieldAtom = makeAtom({
            id: 'atom_field_format_full_scan_source',
            documentId: 'doc_field_format_full_scan_source',
            sourcePath: 'Knowledge_Base/ragformatfullscan/field format full scan source.md',
            title: 'Field Format Full Scan Source',
            content: fieldOpening,
            keywords: ['format', 'payload', 'full scan'],
        });
        const items: KnowledgeQueryItem[] = [
            {
                ...makeQueryItem({ atom: nominalAtom }),
                atom: nominalAtom,
                evidenceSpans: [
                    makeEvidenceSpan({
                        id: 'evidence_nominal_format_opening',
                        documentId: nominalAtom.documentId,
                        sourcePath: nominalAtom.sourcePath,
                        startOffset: nominalDocument.indexOf(nominalOpening),
                        endOffset: nominalDocument.indexOf(nominalOpening) + nominalOpening.length,
                        startLine: 2,
                        endLine: 2,
                        snippet: nominalOpening,
                    }),
                ],
            },
            {
                ...makeQueryItem({ atom: fieldAtom }),
                atom: fieldAtom,
                evidenceSpans: [
                    makeEvidenceSpan({
                        id: 'evidence_field_format_opening',
                        documentId: fieldAtom.documentId,
                        sourcePath: fieldAtom.sourcePath,
                        startOffset: fieldDocument.indexOf(fieldOpening),
                        endOffset: fieldDocument.indexOf(fieldOpening) + fieldOpening.length,
                        startLine: 2,
                        endLine: 2,
                        snippet: fieldOpening,
                    }),
                ],
            },
        ];
        const documentsById = new Map([
            [nominalAtom.documentId, nominalDocument],
            [fieldAtom.documentId, fieldDocument],
        ]);

        const assembly = await assembleRagEvidenceContext({
            query: 'compare nominal format full scan source with field format full scan source',
            items,
            sourceResolver: async (request) => ({
                documentId: request.documentId,
                sourcePath: request.sourcePath,
                content: documentsById.get(request.documentId) || '',
            }),
            paragraphWindow: 1,
            budget: {
                maxFragments: 8,
                maxCharsPerFragment: 900,
                maxTotalChars: 3000,
            },
        });

        const directSupportText = assembly.fragments
            .filter((fragment) => fragment.role === 'direct_support')
            .map((fragment) => fragment.text)
            .join('\n');
        expect(directSupportText).not.toContain('JSON');
        expect(directSupportText).not.toContain('YAML');

        const conflictFragment = assembly.fragments.find((fragment) => fragment.role === 'conflict');
        expect(conflictFragment).toEqual(expect.objectContaining({
            sourceBoundary: 'full_document',
            citationIds: expect.arrayContaining([
                'evidence_nominal_format_opening',
                'evidence_field_format_opening',
            ]),
        }));
        expect(conflictFragment?.text).toContain(jsonFormat);
        expect(conflictFragment?.text).toContain(yamlFormat);
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

    test('does not mark environment-scoped format facts as conflicting evidence', async () => {
        const stagingFormat = 'The payload format is JSON in the staging environment.';
        const productionFormat = 'The payload format is XML in the production environment.';
        const fullDocument = [
            '# Environment Scoped Format Probe',
            '',
            'Environment scoped format probe validates that deployment-environment formats stay condition-qualified.',
            '',
            '## Environment Payload Formats',
            stagingFormat,
            '',
            'Context paragraph keeps both environment-specific formats in one scoped section.',
            '',
            productionFormat,
        ].join('\n');
        const atom = makeAtom({
            id: 'atom_environment_scoped_format',
            documentId: 'doc_environment_scoped_format',
            sourcePath: 'Knowledge_Base/ragformatqualifier/environment scoped format probe.md',
            title: 'Environment Scoped Format Probe',
            content: stagingFormat,
            keywords: ['environment', 'format', 'payload'],
        });
        const item: KnowledgeQueryItem = {
            ...makeQueryItem({ atom }),
            atom,
            evidenceSpans: [
                makeEvidenceSpan({
                    id: 'evidence_staging_format',
                    documentId: atom.documentId,
                    sourcePath: atom.sourcePath,
                    startOffset: fullDocument.indexOf(stagingFormat),
                    endOffset: fullDocument.indexOf(stagingFormat) + stagingFormat.length,
                    startLine: 6,
                    endLine: 6,
                    snippet: stagingFormat,
                }),
                makeEvidenceSpan({
                    id: 'evidence_production_format',
                    documentId: atom.documentId,
                    sourcePath: atom.sourcePath,
                    startOffset: fullDocument.indexOf(productionFormat),
                    endOffset: fullDocument.indexOf(productionFormat) + productionFormat.length,
                    startLine: 10,
                    endLine: 10,
                    snippet: productionFormat,
                }),
            ],
        };

        const assembly = await assembleRagEvidenceContext({
            query: 'what is environment scoped format probe?',
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

        expect(assembly.fragments.some((fragment) => fragment.role === 'conflict')).toBe(false);
        expect(assembly.fragments).toEqual(expect.arrayContaining([
            expect.objectContaining({
                role: 'parent_context',
                documentId: atom.documentId,
                sourceBoundary: 'full_document',
                text: expect.stringContaining(stagingFormat),
            }),
        ]));
        expect(assembly.fragments.map((fragment) => fragment.text).join('\n')).toContain(productionFormat);
    });

    test('marks protocol facts in the same section as conflicting evidence', async () => {
        const httpProtocol = 'The transport protocol is HTTP/1.1 in the release channel.';
        const websocketProtocol = 'The transport protocol is WebSocket in the rollback channel.';
        const fullDocument = [
            '# Protocol Conflict Probe',
            '',
            'Protocol conflict probe validates that explicit transport protocols are comparable operational facts.',
            '',
            '## Transport Contract',
            httpProtocol,
            '',
            'Context paragraph keeps the protocol conflict inside one scoped section.',
            '',
            websocketProtocol,
        ].join('\n');
        const atom = makeAtom({
            id: 'atom_conflicting_protocol',
            documentId: 'doc_conflicting_protocol',
            sourcePath: 'Knowledge_Base/ragprotocolconflict/protocol conflict probe.md',
            title: 'Protocol Conflict Probe',
            content: httpProtocol,
            keywords: ['protocol', 'transport', 'wire'],
        });
        const item: KnowledgeQueryItem = {
            ...makeQueryItem({ atom }),
            atom,
            evidenceSpans: [
                makeEvidenceSpan({
                    id: 'evidence_http_protocol',
                    documentId: atom.documentId,
                    sourcePath: atom.sourcePath,
                    startOffset: fullDocument.indexOf(httpProtocol),
                    endOffset: fullDocument.indexOf(httpProtocol) + httpProtocol.length,
                    startLine: 6,
                    endLine: 6,
                    snippet: httpProtocol,
                }),
                makeEvidenceSpan({
                    id: 'evidence_websocket_protocol',
                    documentId: atom.documentId,
                    sourcePath: atom.sourcePath,
                    startOffset: fullDocument.indexOf(websocketProtocol),
                    endOffset: fullDocument.indexOf(websocketProtocol) + websocketProtocol.length,
                    startLine: 10,
                    endLine: 10,
                    snippet: websocketProtocol,
                }),
            ],
        };

        const assembly = await assembleRagEvidenceContext({
            query: 'what is protocol conflict probe?',
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
            sourceBoundary: 'full_document',
            citationIds: expect.arrayContaining([
                'evidence_http_protocol',
                'evidence_websocket_protocol',
            ]),
        }));
        expect(conflictFragment?.text).toContain(httpProtocol);
        expect(conflictFragment?.text).toContain(websocketProtocol);
    });

    test('finds remote protocol conflicts from the full selected documents beyond matched opening spans', async () => {
        const nominalOpening = 'Nominal protocol full scan source is the scoped comparison document for full-document protocol augmentation.';
        const fieldOpening = 'Field protocol full scan source is the scoped comparison document for full-document protocol augmentation.';
        const httpProtocol = 'The transport protocol is HTTP/1.1 in the remote nominal protocol appendix.';
        const websocketProtocol = 'The transport protocol is WebSocket in the remote field protocol appendix.';
        const nominalDocument = [
            '# Nominal Protocol Full Scan Source',
            nominalOpening,
            '',
            'This opening section is intentionally separate from the remote protocol statement.',
            '',
            'Local protocol filler paragraph one keeps the remote appendix away from the matched opening span.',
            '',
            'Local protocol filler paragraph two keeps the remote appendix away from the matched opening span.',
            '',
            'Local protocol filler paragraph three keeps the remote appendix away from the matched opening span.',
            '',
            'Local protocol filler paragraph four keeps the remote appendix away from the matched opening span.',
            '',
            'Local protocol filler paragraph five keeps the remote appendix away from the matched opening span.',
            '',
            'Local protocol filler paragraph six keeps the remote appendix away from the matched opening span.',
            '',
            '## Remote Nominal Protocol Appendix',
            httpProtocol,
        ].join('\n');
        const fieldDocument = [
            '# Field Protocol Full Scan Source',
            fieldOpening,
            '',
            'This opening section is intentionally separate from the remote protocol statement.',
            '',
            'Local protocol filler paragraph one keeps the remote appendix away from the matched opening span.',
            '',
            'Local protocol filler paragraph two keeps the remote appendix away from the matched opening span.',
            '',
            'Local protocol filler paragraph three keeps the remote appendix away from the matched opening span.',
            '',
            'Local protocol filler paragraph four keeps the remote appendix away from the matched opening span.',
            '',
            'Local protocol filler paragraph five keeps the remote appendix away from the matched opening span.',
            '',
            'Local protocol filler paragraph six keeps the remote appendix away from the matched opening span.',
            '',
            '## Remote Field Protocol Appendix',
            websocketProtocol,
        ].join('\n');
        const nominalAtom = makeAtom({
            id: 'atom_nominal_protocol_full_scan_source',
            documentId: 'doc_nominal_protocol_full_scan_source',
            sourcePath: 'Knowledge_Base/ragprotocolfullscan/nominal protocol full scan source.md',
            title: 'Nominal Protocol Full Scan Source',
            content: nominalOpening,
            keywords: ['protocol', 'transport', 'full scan'],
        });
        const fieldAtom = makeAtom({
            id: 'atom_field_protocol_full_scan_source',
            documentId: 'doc_field_protocol_full_scan_source',
            sourcePath: 'Knowledge_Base/ragprotocolfullscan/field protocol full scan source.md',
            title: 'Field Protocol Full Scan Source',
            content: fieldOpening,
            keywords: ['protocol', 'transport', 'full scan'],
        });
        const items: KnowledgeQueryItem[] = [
            {
                ...makeQueryItem({ atom: nominalAtom }),
                atom: nominalAtom,
                evidenceSpans: [
                    makeEvidenceSpan({
                        id: 'evidence_nominal_protocol_opening',
                        documentId: nominalAtom.documentId,
                        sourcePath: nominalAtom.sourcePath,
                        startOffset: nominalDocument.indexOf(nominalOpening),
                        endOffset: nominalDocument.indexOf(nominalOpening) + nominalOpening.length,
                        startLine: 2,
                        endLine: 2,
                        snippet: nominalOpening,
                    }),
                ],
            },
            {
                ...makeQueryItem({ atom: fieldAtom }),
                atom: fieldAtom,
                evidenceSpans: [
                    makeEvidenceSpan({
                        id: 'evidence_field_protocol_opening',
                        documentId: fieldAtom.documentId,
                        sourcePath: fieldAtom.sourcePath,
                        startOffset: fieldDocument.indexOf(fieldOpening),
                        endOffset: fieldDocument.indexOf(fieldOpening) + fieldOpening.length,
                        startLine: 2,
                        endLine: 2,
                        snippet: fieldOpening,
                    }),
                ],
            },
        ];
        const documentsById = new Map([
            [nominalAtom.documentId, nominalDocument],
            [fieldAtom.documentId, fieldDocument],
        ]);

        const assembly = await assembleRagEvidenceContext({
            query: 'compare nominal protocol full scan source with field protocol full scan source',
            items,
            sourceResolver: async (request) => ({
                documentId: request.documentId,
                sourcePath: request.sourcePath,
                content: documentsById.get(request.documentId) || '',
            }),
            paragraphWindow: 1,
            budget: {
                maxFragments: 8,
                maxCharsPerFragment: 900,
                maxTotalChars: 3000,
            },
        });

        const directSupportText = assembly.fragments
            .filter((fragment) => fragment.role === 'direct_support')
            .map((fragment) => fragment.text)
            .join('\n');
        expect(directSupportText).not.toContain('HTTP/1.1');
        expect(directSupportText).not.toContain('WebSocket');

        const conflictFragment = assembly.fragments.find((fragment) => fragment.role === 'conflict');
        expect(conflictFragment).toEqual(expect.objectContaining({
            sourceBoundary: 'full_document',
            citationIds: expect.arrayContaining([
                'evidence_nominal_protocol_opening',
                'evidence_field_protocol_opening',
            ]),
        }));
        expect(conflictFragment?.text).toContain(httpProtocol);
        expect(conflictFragment?.text).toContain(websocketProtocol);
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

    test('does not mark environment-scoped protocol facts as conflicting evidence', async () => {
        const stagingProtocol = 'The transport protocol is HTTP/2 in the staging environment.';
        const productionProtocol = 'The transport protocol is gRPC in the production environment.';
        const fullDocument = [
            '# Environment Scoped Protocol Probe',
            '',
            'Environment scoped protocol probe validates that deployment-environment protocols stay condition-qualified.',
            '',
            '## Environment Transport Protocols',
            stagingProtocol,
            '',
            'Context paragraph keeps both environment-specific protocols in one scoped section.',
            '',
            productionProtocol,
        ].join('\n');
        const atom = makeAtom({
            id: 'atom_environment_scoped_protocol',
            documentId: 'doc_environment_scoped_protocol',
            sourcePath: 'Knowledge_Base/ragprotocolqualifier/environment scoped protocol probe.md',
            title: 'Environment Scoped Protocol Probe',
            content: stagingProtocol,
            keywords: ['environment', 'protocol', 'transport'],
        });
        const item: KnowledgeQueryItem = {
            ...makeQueryItem({ atom }),
            atom,
            evidenceSpans: [
                makeEvidenceSpan({
                    id: 'evidence_staging_protocol',
                    documentId: atom.documentId,
                    sourcePath: atom.sourcePath,
                    startOffset: fullDocument.indexOf(stagingProtocol),
                    endOffset: fullDocument.indexOf(stagingProtocol) + stagingProtocol.length,
                    startLine: 6,
                    endLine: 6,
                    snippet: stagingProtocol,
                }),
                makeEvidenceSpan({
                    id: 'evidence_production_protocol',
                    documentId: atom.documentId,
                    sourcePath: atom.sourcePath,
                    startOffset: fullDocument.indexOf(productionProtocol),
                    endOffset: fullDocument.indexOf(productionProtocol) + productionProtocol.length,
                    startLine: 10,
                    endLine: 10,
                    snippet: productionProtocol,
                }),
            ],
        };

        const assembly = await assembleRagEvidenceContext({
            query: 'what is environment scoped protocol probe?',
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

        expect(assembly.fragments.some((fragment) => fragment.role === 'conflict')).toBe(false);
        expect(assembly.fragments).toEqual(expect.arrayContaining([
            expect.objectContaining({
                role: 'parent_context',
                documentId: atom.documentId,
                sourceBoundary: 'full_document',
                text: expect.stringContaining(stagingProtocol),
            }),
        ]));
        expect(assembly.fragments.map((fragment) => fragment.text).join('\n')).toContain(productionProtocol);
    });

    test('does not mark current and historical location facts as conflicting evidence', async () => {
        const currentLocation = 'The control module location is Rack A in the current release record.';
        const historicalLocation = 'The control module location is Rack B in the historical placement archive.';
        const fullDocument = [
            '# Temporal Location Probe',
            '',
            'Temporal location probe validates that current and historical placements stay scoped.',
            '',
            '## Module Placement History',
            currentLocation,
            '',
            'Operators should answer with the active placement while retaining the older placement as provenance.',
            '',
            historicalLocation,
        ].join('\n');
        const atom = makeAtom({
            id: 'atom_temporal_location',
            documentId: 'doc_temporal_location',
            sourcePath: 'Knowledge_Base/ragtemporalqualifier/temporal location probe.md',
            title: 'Temporal Location Probe',
            content: currentLocation,
            keywords: ['temporal', 'location', 'module'],
        });
        const item: KnowledgeQueryItem = {
            ...makeQueryItem({ atom }),
            atom,
            evidenceSpans: [
                makeEvidenceSpan({
                    id: 'evidence_current_location',
                    documentId: atom.documentId,
                    sourcePath: atom.sourcePath,
                    startOffset: fullDocument.indexOf(currentLocation),
                    endOffset: fullDocument.indexOf(currentLocation) + currentLocation.length,
                    startLine: 6,
                    endLine: 6,
                    snippet: currentLocation,
                }),
                makeEvidenceSpan({
                    id: 'evidence_historical_location',
                    documentId: atom.documentId,
                    sourcePath: atom.sourcePath,
                    startOffset: fullDocument.indexOf(historicalLocation),
                    endOffset: fullDocument.indexOf(historicalLocation) + historicalLocation.length,
                    startLine: 10,
                    endLine: 10,
                    snippet: historicalLocation,
                }),
            ],
        };

        const assembly = await assembleRagEvidenceContext({
            query: 'what is temporal location probe?',
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

        expect(assembly.fragments.some((fragment) => fragment.role === 'conflict')).toBe(false);
        expect(assembly.fragments).toEqual(expect.arrayContaining([
            expect.objectContaining({
                role: 'parent_context',
                documentId: atom.documentId,
                sourceBoundary: 'full_document',
                text: expect.stringContaining(currentLocation),
            }),
        ]));
        expect(assembly.fragments.map((fragment) => fragment.text).join('\n')).toContain(historicalLocation);
    });

    test('does not mark current and historical state facts as conflicting evidence', async () => {
        const currentState = 'The migration gate status is enabled in the current release record.';
        const historicalState = 'The migration gate status is disabled in the historical rollback archive.';
        const fullDocument = [
            '# Temporal State Status Probe',
            '',
            'Temporal state status probe validates that scoped current and historical status facts are not flattened into one contradiction.',
            '',
            '## Gate Status History',
            currentState,
            '',
            'Operators should answer with the active record while retaining the older record as provenance.',
            '',
            historicalState,
        ].join('\n');
        const atom = makeAtom({
            id: 'atom_temporal_state_status',
            documentId: 'doc_temporal_state_status',
            sourcePath: 'Knowledge_Base/ragtemporalqualifier/temporal state status probe.md',
            title: 'Temporal State Status Probe',
            content: currentState,
            keywords: ['temporal', 'state', 'status'],
        });
        const item: KnowledgeQueryItem = {
            ...makeQueryItem({ atom }),
            atom,
            evidenceSpans: [
                makeEvidenceSpan({
                    id: 'evidence_current_state_status',
                    documentId: atom.documentId,
                    sourcePath: atom.sourcePath,
                    startOffset: fullDocument.indexOf(currentState),
                    endOffset: fullDocument.indexOf(currentState) + currentState.length,
                    startLine: 6,
                    endLine: 6,
                    snippet: currentState,
                }),
                makeEvidenceSpan({
                    id: 'evidence_historical_state_status',
                    documentId: atom.documentId,
                    sourcePath: atom.sourcePath,
                    startOffset: fullDocument.indexOf(historicalState),
                    endOffset: fullDocument.indexOf(historicalState) + historicalState.length,
                    startLine: 10,
                    endLine: 10,
                    snippet: historicalState,
                }),
            ],
        };

        const assembly = await assembleRagEvidenceContext({
            query: 'what is temporal state status probe?',
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

        expect(assembly.fragments.some((fragment) => fragment.role === 'conflict')).toBe(false);
        expect(assembly.fragments).toEqual(expect.arrayContaining([
            expect.objectContaining({
                role: 'parent_context',
                documentId: atom.documentId,
                sourceBoundary: 'full_document',
                text: expect.stringContaining(currentState),
            }),
        ]));
        expect(assembly.fragments.map((fragment) => fragment.text).join('\n')).toContain(historicalState);
    });

    test('does not mark current and historical ownership identity facts as conflicting evidence', async () => {
        const currentOwner = 'The deployment owner is Release Ops in the current release record.';
        const historicalOwner = 'The deployment owner is Rollback Team in the historical rollback archive.';
        const fullDocument = [
            '# Temporal Deployment Owner Probe',
            '',
            'Temporal deployment owner probe validates that current and historical owner facts stay scoped.',
            '',
            '## Deployment Owner History',
            currentOwner,
            '',
            'Operators should answer with the active owner while retaining the older owner as provenance.',
            '',
            historicalOwner,
        ].join('\n');
        const atom = makeAtom({
            id: 'atom_temporal_deployment_owner',
            documentId: 'doc_temporal_deployment_owner',
            sourcePath: 'Knowledge_Base/ragtemporalqualifier/temporal deployment owner probe.md',
            title: 'Temporal Deployment Owner Probe',
            content: currentOwner,
            keywords: ['temporal', 'deployment', 'owner'],
        });
        const item: KnowledgeQueryItem = {
            ...makeQueryItem({ atom }),
            atom,
            evidenceSpans: [
                makeEvidenceSpan({
                    id: 'evidence_current_deployment_owner',
                    documentId: atom.documentId,
                    sourcePath: atom.sourcePath,
                    startOffset: fullDocument.indexOf(currentOwner),
                    endOffset: fullDocument.indexOf(currentOwner) + currentOwner.length,
                    startLine: 6,
                    endLine: 6,
                    snippet: currentOwner,
                }),
                makeEvidenceSpan({
                    id: 'evidence_historical_deployment_owner',
                    documentId: atom.documentId,
                    sourcePath: atom.sourcePath,
                    startOffset: fullDocument.indexOf(historicalOwner),
                    endOffset: fullDocument.indexOf(historicalOwner) + historicalOwner.length,
                    startLine: 10,
                    endLine: 10,
                    snippet: historicalOwner,
                }),
            ],
        };

        const assembly = await assembleRagEvidenceContext({
            query: 'what is temporal deployment owner probe?',
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

        expect(assembly.fragments.some((fragment) => fragment.role === 'conflict')).toBe(false);
        expect(assembly.fragments).toEqual(expect.arrayContaining([
            expect.objectContaining({
                role: 'parent_context',
                documentId: atom.documentId,
                sourceBoundary: 'full_document',
                text: expect.stringContaining(currentOwner),
            }),
        ]));
        expect(assembly.fragments.map((fragment) => fragment.text).join('\n')).toContain(historicalOwner);
    });

    test('does not mark environment-scoped state facts as conflicting evidence', async () => {
        const stagingState = 'The migration gate status is enabled in the staging environment.';
        const productionState = 'The migration gate status is disabled in the production environment.';
        const fullDocument = [
            '# Environment Scoped State Status Probe',
            '',
            'Environment scoped state status probe validates that deployment-environment qualifiers do not become false conflicts.',
            '',
            '## Gate Status By Environment',
            stagingState,
            '',
            'Operators should preserve the environment label when comparing deployment records.',
            '',
            productionState,
        ].join('\n');
        const atom = makeAtom({
            id: 'atom_environment_state_status',
            documentId: 'doc_environment_state_status',
            sourcePath: 'Knowledge_Base/ragenvironmentqualifier/environment scoped state status probe.md',
            title: 'Environment Scoped State Status Probe',
            content: stagingState,
            keywords: ['environment', 'state', 'status'],
        });
        const item: KnowledgeQueryItem = {
            ...makeQueryItem({ atom }),
            atom,
            evidenceSpans: [
                makeEvidenceSpan({
                    id: 'evidence_staging_state_status',
                    documentId: atom.documentId,
                    sourcePath: atom.sourcePath,
                    startOffset: fullDocument.indexOf(stagingState),
                    endOffset: fullDocument.indexOf(stagingState) + stagingState.length,
                    startLine: 6,
                    endLine: 6,
                    snippet: stagingState,
                }),
                makeEvidenceSpan({
                    id: 'evidence_production_state_status',
                    documentId: atom.documentId,
                    sourcePath: atom.sourcePath,
                    startOffset: fullDocument.indexOf(productionState),
                    endOffset: fullDocument.indexOf(productionState) + productionState.length,
                    startLine: 10,
                    endLine: 10,
                    snippet: productionState,
                }),
            ],
        };

        const assembly = await assembleRagEvidenceContext({
            query: 'what is environment scoped state status probe?',
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

        expect(assembly.fragments.some((fragment) => fragment.role === 'conflict')).toBe(false);
        expect(assembly.fragments).toEqual(expect.arrayContaining([
            expect.objectContaining({
                role: 'parent_context',
                documentId: atom.documentId,
                sourceBoundary: 'full_document',
                text: expect.stringContaining(stagingState),
            }),
        ]));
        expect(assembly.fragments.map((fragment) => fragment.text).join('\n')).toContain(productionState);
    });

    test('does not mark environment-scoped ownership identity facts as conflicting evidence', async () => {
        const stagingOwner = 'The deployment owner is Release Ops in the staging environment.';
        const productionOwner = 'The deployment owner is Rollback Team in the production environment.';
        const fullDocument = [
            '# Environment Scoped Deployment Owner Probe',
            '',
            'Environment scoped deployment owner probe validates that deployment-environment qualifiers do not become false ownership conflicts.',
            '',
            '## Deployment Owner By Environment',
            stagingOwner,
            '',
            'Operators should preserve the environment label before comparing owner records.',
            '',
            productionOwner,
        ].join('\n');
        const atom = makeAtom({
            id: 'atom_environment_deployment_owner',
            documentId: 'doc_environment_deployment_owner',
            sourcePath: 'Knowledge_Base/ragenvironmentqualifier/environment scoped deployment owner probe.md',
            title: 'Environment Scoped Deployment Owner Probe',
            content: stagingOwner,
            keywords: ['environment', 'deployment', 'owner'],
        });
        const item: KnowledgeQueryItem = {
            ...makeQueryItem({ atom }),
            atom,
            evidenceSpans: [
                makeEvidenceSpan({
                    id: 'evidence_staging_deployment_owner',
                    documentId: atom.documentId,
                    sourcePath: atom.sourcePath,
                    startOffset: fullDocument.indexOf(stagingOwner),
                    endOffset: fullDocument.indexOf(stagingOwner) + stagingOwner.length,
                    startLine: 6,
                    endLine: 6,
                    snippet: stagingOwner,
                }),
                makeEvidenceSpan({
                    id: 'evidence_production_deployment_owner',
                    documentId: atom.documentId,
                    sourcePath: atom.sourcePath,
                    startOffset: fullDocument.indexOf(productionOwner),
                    endOffset: fullDocument.indexOf(productionOwner) + productionOwner.length,
                    startLine: 10,
                    endLine: 10,
                    snippet: productionOwner,
                }),
            ],
        };

        const assembly = await assembleRagEvidenceContext({
            query: 'what is environment scoped deployment owner probe?',
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

        expect(assembly.fragments.some((fragment) => fragment.role === 'conflict')).toBe(false);
        expect(assembly.fragments).toEqual(expect.arrayContaining([
            expect.objectContaining({
                role: 'parent_context',
                documentId: atom.documentId,
                sourceBoundary: 'full_document',
                text: expect.stringContaining(stagingOwner),
            }),
        ]));
        expect(assembly.fragments.map((fragment) => fragment.text).join('\n')).toContain(productionOwner);
    });

    test('does not mark version-scoped state facts as conflicting evidence', async () => {
        const v1State = 'The migration gate status is enabled in version 1.0.';
        const v2State = 'The migration gate status is disabled in version 2.0.';
        const fullDocument = [
            '# Version Scoped State Status Probe',
            '',
            'Version scoped state status probe validates that version qualifiers do not become false conflicts.',
            '',
            '## Gate Status By Version',
            v1State,
            '',
            'Operators should preserve the version label when comparing release records.',
            '',
            v2State,
        ].join('\n');
        const atom = makeAtom({
            id: 'atom_version_state_status',
            documentId: 'doc_version_state_status',
            sourcePath: 'Knowledge_Base/ragversionqualifier/version scoped state status probe.md',
            title: 'Version Scoped State Status Probe',
            content: v1State,
            keywords: ['version', 'state', 'status'],
        });
        const item: KnowledgeQueryItem = {
            ...makeQueryItem({ atom }),
            atom,
            evidenceSpans: [
                makeEvidenceSpan({
                    id: 'evidence_v1_state_status',
                    documentId: atom.documentId,
                    sourcePath: atom.sourcePath,
                    startOffset: fullDocument.indexOf(v1State),
                    endOffset: fullDocument.indexOf(v1State) + v1State.length,
                    startLine: 6,
                    endLine: 6,
                    snippet: v1State,
                }),
                makeEvidenceSpan({
                    id: 'evidence_v2_state_status',
                    documentId: atom.documentId,
                    sourcePath: atom.sourcePath,
                    startOffset: fullDocument.indexOf(v2State),
                    endOffset: fullDocument.indexOf(v2State) + v2State.length,
                    startLine: 10,
                    endLine: 10,
                    snippet: v2State,
                }),
            ],
        };

        const assembly = await assembleRagEvidenceContext({
            query: 'what is version scoped state status probe?',
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

        expect(assembly.fragments.some((fragment) => fragment.role === 'conflict')).toBe(false);
        expect(assembly.fragments).toEqual(expect.arrayContaining([
            expect.objectContaining({
                role: 'parent_context',
                documentId: atom.documentId,
                sourceBoundary: 'full_document',
                text: expect.stringContaining(v1State),
            }),
        ]));
        expect(assembly.fragments.map((fragment) => fragment.text).join('\n')).toContain(v2State);
    });

    test('does not mark version-scoped quantity facts as conflicting evidence', async () => {
        const v1Limit = 'The retry limit is 3 in version 1.0.';
        const v2Limit = 'The retry limit is 5 in version 2.0.';
        const fullDocument = [
            '# Version Scoped Retry Limit Probe',
            '',
            'Version scoped retry limit probe validates that version qualifiers do not become false quantity conflicts.',
            '',
            '## Retry Limit By Version',
            v1Limit,
            '',
            'Operators should preserve the version label when comparing retry records.',
            '',
            v2Limit,
        ].join('\n');
        const atom = makeAtom({
            id: 'atom_version_retry_limit',
            documentId: 'doc_version_retry_limit',
            sourcePath: 'Knowledge_Base/ragversionqualifier/version scoped retry limit probe.md',
            title: 'Version Scoped Retry Limit Probe',
            content: v1Limit,
            keywords: ['version', 'quantity', 'retry', 'limit'],
        });
        const item: KnowledgeQueryItem = {
            ...makeQueryItem({ atom }),
            atom,
            evidenceSpans: [
                makeEvidenceSpan({
                    id: 'evidence_v1_retry_limit',
                    documentId: atom.documentId,
                    sourcePath: atom.sourcePath,
                    startOffset: fullDocument.indexOf(v1Limit),
                    endOffset: fullDocument.indexOf(v1Limit) + v1Limit.length,
                    startLine: 6,
                    endLine: 6,
                    snippet: v1Limit,
                }),
                makeEvidenceSpan({
                    id: 'evidence_v2_retry_limit',
                    documentId: atom.documentId,
                    sourcePath: atom.sourcePath,
                    startOffset: fullDocument.indexOf(v2Limit),
                    endOffset: fullDocument.indexOf(v2Limit) + v2Limit.length,
                    startLine: 10,
                    endLine: 10,
                    snippet: v2Limit,
                }),
            ],
        };

        const assembly = await assembleRagEvidenceContext({
            query: 'what is version scoped retry limit probe?',
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

        expect(assembly.fragments.some((fragment) => fragment.role === 'conflict')).toBe(false);
        expect(assembly.fragments).toEqual(expect.arrayContaining([
            expect.objectContaining({
                role: 'parent_context',
                documentId: atom.documentId,
                sourceBoundary: 'full_document',
                text: expect.stringContaining(v1Limit),
            }),
        ]));
        expect(assembly.fragments.map((fragment) => fragment.text).join('\n')).toContain(v2Limit);
    });

    test('does not mark version-scoped ownership identity facts as conflicting evidence', async () => {
        const v1Owner = 'The deployment owner is Release Ops in version 1.0.';
        const v2Owner = 'The deployment owner is Rollback Team in version 2.0.';
        const fullDocument = [
            '# Version Scoped Deployment Owner Probe',
            '',
            'Version scoped deployment owner probe validates that version qualifiers do not become false ownership conflicts.',
            '',
            '## Deployment Owner By Version',
            v1Owner,
            '',
            'Operators should preserve the version label before comparing owner records.',
            '',
            v2Owner,
        ].join('\n');
        const atom = makeAtom({
            id: 'atom_version_deployment_owner',
            documentId: 'doc_version_deployment_owner',
            sourcePath: 'Knowledge_Base/ragversionqualifier/version scoped deployment owner probe.md',
            title: 'Version Scoped Deployment Owner Probe',
            content: v1Owner,
            keywords: ['version', 'deployment', 'owner'],
        });
        const item: KnowledgeQueryItem = {
            ...makeQueryItem({ atom }),
            atom,
            evidenceSpans: [
                makeEvidenceSpan({
                    id: 'evidence_v1_deployment_owner',
                    documentId: atom.documentId,
                    sourcePath: atom.sourcePath,
                    startOffset: fullDocument.indexOf(v1Owner),
                    endOffset: fullDocument.indexOf(v1Owner) + v1Owner.length,
                    startLine: 6,
                    endLine: 6,
                    snippet: v1Owner,
                }),
                makeEvidenceSpan({
                    id: 'evidence_v2_deployment_owner',
                    documentId: atom.documentId,
                    sourcePath: atom.sourcePath,
                    startOffset: fullDocument.indexOf(v2Owner),
                    endOffset: fullDocument.indexOf(v2Owner) + v2Owner.length,
                    startLine: 10,
                    endLine: 10,
                    snippet: v2Owner,
                }),
            ],
        };

        const assembly = await assembleRagEvidenceContext({
            query: 'what is version scoped deployment owner probe?',
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

        expect(assembly.fragments.some((fragment) => fragment.role === 'conflict')).toBe(false);
        expect(assembly.fragments).toEqual(expect.arrayContaining([
            expect.objectContaining({
                role: 'parent_context',
                documentId: atom.documentId,
                sourceBoundary: 'full_document',
                text: expect.stringContaining(v1Owner),
            }),
        ]));
        expect(assembly.fragments.map((fragment) => fragment.text).join('\n')).toContain(v2Owner);
    });

    test('does not mark platform-scoped state facts as conflicting evidence', async () => {
        const windowsState = 'The migration gate status is enabled on the Windows platform.';
        const androidState = 'The migration gate status is disabled on the Android platform.';
        const fullDocument = [
            '# Platform Scoped State Status Probe',
            '',
            'Platform scoped state status probe validates that OS/platform qualifiers do not become false conflicts.',
            '',
            '## Gate Status By Platform',
            windowsState,
            '',
            'Operators should preserve the platform label when comparing runtime records.',
            '',
            androidState,
        ].join('\n');
        const atom = makeAtom({
            id: 'atom_platform_state_status',
            documentId: 'doc_platform_state_status',
            sourcePath: 'Knowledge_Base/ragplatformqualifier/platform scoped state status probe.md',
            title: 'Platform Scoped State Status Probe',
            content: windowsState,
            keywords: ['platform', 'state', 'status'],
        });
        const item: KnowledgeQueryItem = {
            ...makeQueryItem({ atom }),
            atom,
            evidenceSpans: [
                makeEvidenceSpan({
                    id: 'evidence_windows_state_status',
                    documentId: atom.documentId,
                    sourcePath: atom.sourcePath,
                    startOffset: fullDocument.indexOf(windowsState),
                    endOffset: fullDocument.indexOf(windowsState) + windowsState.length,
                    startLine: 6,
                    endLine: 6,
                    snippet: windowsState,
                }),
                makeEvidenceSpan({
                    id: 'evidence_android_state_status',
                    documentId: atom.documentId,
                    sourcePath: atom.sourcePath,
                    startOffset: fullDocument.indexOf(androidState),
                    endOffset: fullDocument.indexOf(androidState) + androidState.length,
                    startLine: 10,
                    endLine: 10,
                    snippet: androidState,
                }),
            ],
        };

        const assembly = await assembleRagEvidenceContext({
            query: 'what is platform scoped state status probe?',
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

        expect(assembly.fragments.some((fragment) => fragment.role === 'conflict')).toBe(false);
        expect(assembly.fragments).toEqual(expect.arrayContaining([
            expect.objectContaining({
                role: 'parent_context',
                documentId: atom.documentId,
                sourceBoundary: 'full_document',
                text: expect.stringContaining(windowsState),
            }),
        ]));
        expect(assembly.fragments.map((fragment) => fragment.text).join('\n')).toContain(androidState);
    });

    test('does not mark platform-scoped quantity facts as conflicting evidence', async () => {
        const windowsLimit = 'The retry limit is 3 on the Windows platform.';
        const androidLimit = 'The retry limit is 5 on the Android platform.';
        const fullDocument = [
            '# Platform Scoped Retry Limit Probe',
            '',
            'Platform scoped retry limit probe validates that OS/platform qualifiers do not become false quantity conflicts.',
            '',
            '## Retry Limit By Platform',
            windowsLimit,
            '',
            'Operators should preserve the platform label when comparing retry records.',
            '',
            androidLimit,
        ].join('\n');
        const atom = makeAtom({
            id: 'atom_platform_retry_limit',
            documentId: 'doc_platform_retry_limit',
            sourcePath: 'Knowledge_Base/ragplatformqualifier/platform scoped retry limit probe.md',
            title: 'Platform Scoped Retry Limit Probe',
            content: windowsLimit,
            keywords: ['platform', 'quantity', 'retry', 'limit'],
        });
        const item: KnowledgeQueryItem = {
            ...makeQueryItem({ atom }),
            atom,
            evidenceSpans: [
                makeEvidenceSpan({
                    id: 'evidence_windows_retry_limit',
                    documentId: atom.documentId,
                    sourcePath: atom.sourcePath,
                    startOffset: fullDocument.indexOf(windowsLimit),
                    endOffset: fullDocument.indexOf(windowsLimit) + windowsLimit.length,
                    startLine: 6,
                    endLine: 6,
                    snippet: windowsLimit,
                }),
                makeEvidenceSpan({
                    id: 'evidence_android_retry_limit',
                    documentId: atom.documentId,
                    sourcePath: atom.sourcePath,
                    startOffset: fullDocument.indexOf(androidLimit),
                    endOffset: fullDocument.indexOf(androidLimit) + androidLimit.length,
                    startLine: 10,
                    endLine: 10,
                    snippet: androidLimit,
                }),
            ],
        };

        const assembly = await assembleRagEvidenceContext({
            query: 'what is platform scoped retry limit probe?',
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

        expect(assembly.fragments.some((fragment) => fragment.role === 'conflict')).toBe(false);
        expect(assembly.fragments).toEqual(expect.arrayContaining([
            expect.objectContaining({
                role: 'parent_context',
                documentId: atom.documentId,
                sourceBoundary: 'full_document',
                text: expect.stringContaining(windowsLimit),
            }),
        ]));
        expect(assembly.fragments.map((fragment) => fragment.text).join('\n')).toContain(androidLimit);
    });

    test('does not mark platform-scoped ownership identity facts as conflicting evidence', async () => {
        const windowsOwner = 'The deployment owner is Release Ops on the Windows platform.';
        const androidOwner = 'The deployment owner is Rollback Team on the Android platform.';
        const fullDocument = [
            '# Platform Scoped Deployment Owner Probe',
            '',
            'Platform scoped deployment owner probe validates that OS/platform qualifiers do not become false ownership conflicts.',
            '',
            '## Deployment Owner By Platform',
            windowsOwner,
            '',
            'Operators should preserve the platform label before comparing owner records.',
            '',
            androidOwner,
        ].join('\n');
        const atom = makeAtom({
            id: 'atom_platform_deployment_owner',
            documentId: 'doc_platform_deployment_owner',
            sourcePath: 'Knowledge_Base/ragplatformqualifier/platform scoped deployment owner probe.md',
            title: 'Platform Scoped Deployment Owner Probe',
            content: windowsOwner,
            keywords: ['platform', 'deployment', 'owner'],
        });
        const item: KnowledgeQueryItem = {
            ...makeQueryItem({ atom }),
            atom,
            evidenceSpans: [
                makeEvidenceSpan({
                    id: 'evidence_windows_deployment_owner',
                    documentId: atom.documentId,
                    sourcePath: atom.sourcePath,
                    startOffset: fullDocument.indexOf(windowsOwner),
                    endOffset: fullDocument.indexOf(windowsOwner) + windowsOwner.length,
                    startLine: 6,
                    endLine: 6,
                    snippet: windowsOwner,
                }),
                makeEvidenceSpan({
                    id: 'evidence_android_deployment_owner',
                    documentId: atom.documentId,
                    sourcePath: atom.sourcePath,
                    startOffset: fullDocument.indexOf(androidOwner),
                    endOffset: fullDocument.indexOf(androidOwner) + androidOwner.length,
                    startLine: 10,
                    endLine: 10,
                    snippet: androidOwner,
                }),
            ],
        };

        const assembly = await assembleRagEvidenceContext({
            query: 'what is platform scoped deployment owner probe?',
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

        expect(assembly.fragments.some((fragment) => fragment.role === 'conflict')).toBe(false);
        expect(assembly.fragments).toEqual(expect.arrayContaining([
            expect.objectContaining({
                role: 'parent_context',
                documentId: atom.documentId,
                sourceBoundary: 'full_document',
                text: expect.stringContaining(windowsOwner),
            }),
        ]));
        expect(assembly.fragments.map((fragment) => fragment.text).join('\n')).toContain(androidOwner);
    });

    test('does not mark current and historical date facts as conflicting evidence', async () => {
        const currentDate = 'The migration release date is 2026-08-15 in the current release record.';
        const historicalDate = 'The migration release date is 2026-07-01 in the historical rollout archive.';
        const fullDocument = [
            '# Temporal Release Date Probe',
            '',
            'Temporal release date probe validates that scoped current and historical dates are not flattened into one contradiction.',
            '',
            '## Release Date History',
            currentDate,
            '',
            'Operators should answer with the current schedule while retaining the older schedule as provenance.',
            '',
            historicalDate,
        ].join('\n');
        const atom = makeAtom({
            id: 'atom_temporal_release_date',
            documentId: 'doc_temporal_release_date',
            sourcePath: 'Knowledge_Base/ragtemporalqualifier/temporal release date probe.md',
            title: 'Temporal Release Date Probe',
            content: currentDate,
            keywords: ['temporal', 'release', 'date'],
        });
        const item: KnowledgeQueryItem = {
            ...makeQueryItem({ atom }),
            atom,
            evidenceSpans: [
                makeEvidenceSpan({
                    id: 'evidence_current_release_date',
                    documentId: atom.documentId,
                    sourcePath: atom.sourcePath,
                    startOffset: fullDocument.indexOf(currentDate),
                    endOffset: fullDocument.indexOf(currentDate) + currentDate.length,
                    startLine: 6,
                    endLine: 6,
                    snippet: currentDate,
                }),
                makeEvidenceSpan({
                    id: 'evidence_historical_release_date',
                    documentId: atom.documentId,
                    sourcePath: atom.sourcePath,
                    startOffset: fullDocument.indexOf(historicalDate),
                    endOffset: fullDocument.indexOf(historicalDate) + historicalDate.length,
                    startLine: 10,
                    endLine: 10,
                    snippet: historicalDate,
                }),
            ],
        };

        const assembly = await assembleRagEvidenceContext({
            query: 'what is temporal release date probe?',
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

        expect(assembly.fragments.some((fragment) => fragment.role === 'conflict')).toBe(false);
        expect(assembly.fragments).toEqual(expect.arrayContaining([
            expect.objectContaining({
                role: 'parent_context',
                documentId: atom.documentId,
                sourceBoundary: 'full_document',
                text: expect.stringContaining(currentDate),
            }),
        ]));
        expect(assembly.fragments.map((fragment) => fragment.text).join('\n')).toContain(historicalDate);
    });

    test('does not mark current and historical quantity facts as conflicting evidence', async () => {
        const currentLimit = 'The retry limit is 3 in the current release record.';
        const historicalLimit = 'The retry limit is 5 in the historical rollback archive.';
        const fullDocument = [
            '# Temporal Retry Limit Probe',
            '',
            'Temporal retry limit probe validates that scoped current and historical quantities are not flattened into one contradiction.',
            '',
            '## Retry Limit History',
            currentLimit,
            '',
            'Operators should answer with the active limit while retaining the older limit as provenance.',
            '',
            historicalLimit,
        ].join('\n');
        const atom = makeAtom({
            id: 'atom_temporal_retry_limit',
            documentId: 'doc_temporal_retry_limit',
            sourcePath: 'Knowledge_Base/ragtemporalqualifier/temporal retry limit probe.md',
            title: 'Temporal Retry Limit Probe',
            content: currentLimit,
            keywords: ['temporal', 'quantity', 'retry', 'limit'],
        });
        const item: KnowledgeQueryItem = {
            ...makeQueryItem({ atom }),
            atom,
            evidenceSpans: [
                makeEvidenceSpan({
                    id: 'evidence_current_retry_limit',
                    documentId: atom.documentId,
                    sourcePath: atom.sourcePath,
                    startOffset: fullDocument.indexOf(currentLimit),
                    endOffset: fullDocument.indexOf(currentLimit) + currentLimit.length,
                    startLine: 6,
                    endLine: 6,
                    snippet: currentLimit,
                }),
                makeEvidenceSpan({
                    id: 'evidence_historical_retry_limit',
                    documentId: atom.documentId,
                    sourcePath: atom.sourcePath,
                    startOffset: fullDocument.indexOf(historicalLimit),
                    endOffset: fullDocument.indexOf(historicalLimit) + historicalLimit.length,
                    startLine: 10,
                    endLine: 10,
                    snippet: historicalLimit,
                }),
            ],
        };

        const assembly = await assembleRagEvidenceContext({
            query: 'what is temporal retry limit probe?',
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

        expect(assembly.fragments.some((fragment) => fragment.role === 'conflict')).toBe(false);
        expect(assembly.fragments).toEqual(expect.arrayContaining([
            expect.objectContaining({
                role: 'parent_context',
                documentId: atom.documentId,
                sourceBoundary: 'full_document',
                text: expect.stringContaining(currentLimit),
            }),
        ]));
        expect(assembly.fragments.map((fragment) => fragment.text).join('\n')).toContain(historicalLimit);
    });

    test('does not mark current and planned date facts as conflicting evidence', async () => {
        const currentDate = 'The migration release date is 2026-08-15 in the current release record.';
        const plannedDate = 'The migration release date is 2026-09-20 in the planned rollout draft.';
        const fullDocument = [
            '# Temporal Planned Release Date Probe',
            '',
            'Temporal planned release date probe validates that scoped current and planned dates are not flattened into one contradiction.',
            '',
            '## Release Date Roadmap',
            currentDate,
            '',
            'Operators should answer with the current schedule while retaining planned roadmap material as future-qualified evidence.',
            '',
            plannedDate,
        ].join('\n');
        const atom = makeAtom({
            id: 'atom_temporal_planned_release_date',
            documentId: 'doc_temporal_planned_release_date',
            sourcePath: 'Knowledge_Base/ragtemporalqualifier/temporal planned release date probe.md',
            title: 'Temporal Planned Release Date Probe',
            content: currentDate,
            keywords: ['temporal', 'planned', 'release', 'date'],
        });
        const item: KnowledgeQueryItem = {
            ...makeQueryItem({ atom }),
            atom,
            evidenceSpans: [
                makeEvidenceSpan({
                    id: 'evidence_current_planned_release_date',
                    documentId: atom.documentId,
                    sourcePath: atom.sourcePath,
                    startOffset: fullDocument.indexOf(currentDate),
                    endOffset: fullDocument.indexOf(currentDate) + currentDate.length,
                    startLine: 6,
                    endLine: 6,
                    snippet: currentDate,
                }),
                makeEvidenceSpan({
                    id: 'evidence_planned_release_date',
                    documentId: atom.documentId,
                    sourcePath: atom.sourcePath,
                    startOffset: fullDocument.indexOf(plannedDate),
                    endOffset: fullDocument.indexOf(plannedDate) + plannedDate.length,
                    startLine: 10,
                    endLine: 10,
                    snippet: plannedDate,
                }),
            ],
        };

        const assembly = await assembleRagEvidenceContext({
            query: 'what is temporal planned release date probe?',
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

        expect(assembly.fragments.some((fragment) => fragment.role === 'conflict')).toBe(false);
        expect(assembly.fragments).toEqual(expect.arrayContaining([
            expect.objectContaining({
                role: 'parent_context',
                documentId: atom.documentId,
                sourceBoundary: 'full_document',
                text: expect.stringContaining(currentDate),
            }),
        ]));
        expect(assembly.fragments.map((fragment) => fragment.text).join('\n')).toContain(plannedDate);
    });

    test('does not mark current and planned date facts from different documents as conflicting evidence', async () => {
        const currentDate = 'The migration release date is 2026-08-15 in the current release record.';
        const plannedDate = 'The migration release date is 2026-09-20 in the planned rollout draft.';
        const currentDocument = [
            '# Temporal Current Release Source',
            '',
            'Temporal current release source is the active schedule document.',
            '',
            '## Current Schedule',
            currentDate,
        ].join('\n');
        const plannedDocument = [
            '# Temporal Planned Roadmap Source',
            '',
            'Temporal planned roadmap source is the future-qualified schedule document.',
            '',
            '## Planned Roadmap',
            plannedDate,
        ].join('\n');
        const currentAtom = makeAtom({
            id: 'atom_temporal_current_release_source',
            documentId: 'doc_temporal_current_release_source',
            sourcePath: 'Knowledge_Base/ragtemporalcrossscope/temporal current release source.md',
            title: 'Temporal Current Release Source',
            content: currentDate,
            keywords: ['temporal', 'current', 'release', 'date'],
        });
        const plannedAtom = makeAtom({
            id: 'atom_temporal_planned_roadmap_source',
            documentId: 'doc_temporal_planned_roadmap_source',
            sourcePath: 'Knowledge_Base/ragtemporalcrossscope/temporal planned roadmap source.md',
            title: 'Temporal Planned Roadmap Source',
            content: plannedDate,
            keywords: ['temporal', 'planned', 'release', 'date'],
        });
        const currentItem = makeQueryItem({
            atom: currentAtom,
            evidence: {
                id: 'evidence_temporal_current_release_date',
                documentId: currentAtom.documentId,
                sourcePath: currentAtom.sourcePath,
                startOffset: currentDocument.indexOf(currentDate),
                endOffset: currentDocument.indexOf(currentDate) + currentDate.length,
                startLine: 6,
                endLine: 6,
                snippet: currentDate,
            },
        });
        const plannedItem = makeQueryItem({
            atom: plannedAtom,
            evidence: {
                id: 'evidence_temporal_planned_release_date',
                documentId: plannedAtom.documentId,
                sourcePath: plannedAtom.sourcePath,
                startOffset: plannedDocument.indexOf(plannedDate),
                endOffset: plannedDocument.indexOf(plannedDate) + plannedDate.length,
                startLine: 6,
                endLine: 6,
                snippet: plannedDate,
            },
        });

        const assembly = await assembleRagEvidenceContext({
            query: 'compare temporal current release source with temporal planned roadmap source',
            items: [currentItem, plannedItem],
            sourceResolver: async (lookup) => ({
                documentId: lookup.documentId,
                sourcePath: lookup.sourcePath,
                content: lookup.documentId === currentAtom.documentId ? currentDocument : plannedDocument,
            }),
            paragraphWindow: 5,
            budget: {
                maxFragments: 10,
                maxCharsPerFragment: 700,
                maxTotalChars: 2600,
            },
        });

        expect(assembly.fragments.some((fragment) => fragment.role === 'conflict')).toBe(false);
        expect(assembly.fragments).toEqual(expect.arrayContaining([
            expect.objectContaining({
                role: 'parent_context',
                documentId: currentAtom.documentId,
                sourceBoundary: 'full_document',
                text: expect.stringContaining(currentDate),
            }),
            expect.objectContaining({
                role: 'parent_context',
                documentId: plannedAtom.documentId,
                sourceBoundary: 'full_document',
                text: expect.stringContaining(plannedDate),
            }),
        ]));
    });

    test('does not mark current and historical quantity facts from different documents as conflicting evidence', async () => {
        const currentLimit = 'The retry limit is 3 in the current release record.';
        const historicalLimit = 'The retry limit is 5 in the historical rollback archive.';
        const currentDocument = [
            '# Temporal Current Retry Limit Source',
            '',
            'Temporal current retry limit source is the active retry policy document.',
            '',
            '## Current Retry Limit',
            currentLimit,
        ].join('\n');
        const historicalDocument = [
            '# Temporal Historical Retry Limit Source',
            '',
            'Temporal historical retry limit source is the retired rollback policy document.',
            '',
            '## Historical Retry Limit',
            historicalLimit,
        ].join('\n');
        const currentAtom = makeAtom({
            id: 'atom_temporal_current_retry_limit_source',
            documentId: 'doc_temporal_current_retry_limit_source',
            sourcePath: 'Knowledge_Base/ragtemporalcrossscope/temporal current retry limit source.md',
            title: 'Temporal Current Retry Limit Source',
            content: currentLimit,
            keywords: ['temporal', 'current', 'retry', 'limit'],
        });
        const historicalAtom = makeAtom({
            id: 'atom_temporal_historical_retry_limit_source',
            documentId: 'doc_temporal_historical_retry_limit_source',
            sourcePath: 'Knowledge_Base/ragtemporalcrossscope/temporal historical retry limit source.md',
            title: 'Temporal Historical Retry Limit Source',
            content: historicalLimit,
            keywords: ['temporal', 'historical', 'retry', 'limit'],
        });
        const currentItem = makeQueryItem({
            atom: currentAtom,
            evidence: {
                id: 'evidence_temporal_current_retry_limit',
                documentId: currentAtom.documentId,
                sourcePath: currentAtom.sourcePath,
                startOffset: currentDocument.indexOf(currentLimit),
                endOffset: currentDocument.indexOf(currentLimit) + currentLimit.length,
                startLine: 6,
                endLine: 6,
                snippet: currentLimit,
            },
        });
        const historicalItem = makeQueryItem({
            atom: historicalAtom,
            evidence: {
                id: 'evidence_temporal_historical_retry_limit',
                documentId: historicalAtom.documentId,
                sourcePath: historicalAtom.sourcePath,
                startOffset: historicalDocument.indexOf(historicalLimit),
                endOffset: historicalDocument.indexOf(historicalLimit) + historicalLimit.length,
                startLine: 6,
                endLine: 6,
                snippet: historicalLimit,
            },
        });

        const assembly = await assembleRagEvidenceContext({
            query: 'compare temporal current retry limit source with temporal historical retry limit source',
            items: [currentItem, historicalItem],
            sourceResolver: async (lookup) => ({
                documentId: lookup.documentId,
                sourcePath: lookup.sourcePath,
                content: lookup.documentId === currentAtom.documentId ? currentDocument : historicalDocument,
            }),
            paragraphWindow: 5,
            budget: {
                maxFragments: 10,
                maxCharsPerFragment: 700,
                maxTotalChars: 2600,
            },
        });

        expect(assembly.fragments.some((fragment) => fragment.role === 'conflict')).toBe(false);
        expect(assembly.fragments).toEqual(expect.arrayContaining([
            expect.objectContaining({
                role: 'parent_context',
                documentId: currentAtom.documentId,
                sourceBoundary: 'full_document',
                text: expect.stringContaining(currentLimit),
            }),
            expect.objectContaining({
                role: 'parent_context',
                documentId: historicalAtom.documentId,
                sourceBoundary: 'full_document',
                text: expect.stringContaining(historicalLimit),
            }),
        ]));
        expect(assembly.sourceDecisions).toEqual(expect.arrayContaining([
            expect.objectContaining({
                documentId: currentAtom.documentId,
                status: 'read',
                charsRead: currentDocument.length,
            }),
            expect.objectContaining({
                documentId: historicalAtom.documentId,
                status: 'read',
                charsRead: historicalDocument.length,
            }),
        ]));
    });

    test('does not mark condition-scoped ownership identity facts from different documents as conflicting evidence', async () => {
        const conditionScopedOwnerCases = [
            {
                query: 'compare cross environment staging owner source with cross environment production owner source',
                leftTitle: 'Cross Environment Staging Owner Source',
                rightTitle: 'Cross Environment Production Owner Source',
                leftDocumentId: 'doc_cross_environment_staging_owner_source',
                rightDocumentId: 'doc_cross_environment_production_owner_source',
                leftSourcePath: 'Knowledge_Base/ragconditionownercrossscope/cross environment staging owner source.md',
                rightSourcePath: 'Knowledge_Base/ragconditionownercrossscope/cross environment production owner source.md',
                leftOwner: 'The deployment owner is Release Ops in the staging environment.',
                rightOwner: 'The deployment owner is Rollback Team in the production environment.',
                leftKeywords: ['environment', 'staging', 'owner'],
                rightKeywords: ['environment', 'production', 'owner'],
            },
            {
                query: 'compare cross version one owner source with cross version two owner source',
                leftTitle: 'Cross Version One Owner Source',
                rightTitle: 'Cross Version Two Owner Source',
                leftDocumentId: 'doc_cross_version_one_owner_source',
                rightDocumentId: 'doc_cross_version_two_owner_source',
                leftSourcePath: 'Knowledge_Base/ragconditionownercrossscope/cross version one owner source.md',
                rightSourcePath: 'Knowledge_Base/ragconditionownercrossscope/cross version two owner source.md',
                leftOwner: 'The deployment owner is Release Ops in version 1.0.',
                rightOwner: 'The deployment owner is Rollback Team in version 2.0.',
                leftKeywords: ['version', 'one', 'owner'],
                rightKeywords: ['version', 'two', 'owner'],
            },
            {
                query: 'compare cross platform windows owner source with cross platform android owner source',
                leftTitle: 'Cross Platform Windows Owner Source',
                rightTitle: 'Cross Platform Android Owner Source',
                leftDocumentId: 'doc_cross_platform_windows_owner_source',
                rightDocumentId: 'doc_cross_platform_android_owner_source',
                leftSourcePath: 'Knowledge_Base/ragconditionownercrossscope/cross platform windows owner source.md',
                rightSourcePath: 'Knowledge_Base/ragconditionownercrossscope/cross platform android owner source.md',
                leftOwner: 'The deployment owner is Release Ops on the Windows platform.',
                rightOwner: 'The deployment owner is Rollback Team on the Android platform.',
                leftKeywords: ['platform', 'windows', 'owner'],
                rightKeywords: ['platform', 'android', 'owner'],
            },
        ];

        for (const ownerCase of conditionScopedOwnerCases) {
            const leftDocument = [
                `# ${ownerCase.leftTitle}`,
                '',
                `${ownerCase.leftTitle} records the scoped deployment owner.`,
                '',
                '## Scoped Owner',
                ownerCase.leftOwner,
            ].join('\n');
            const rightDocument = [
                `# ${ownerCase.rightTitle}`,
                '',
                `${ownerCase.rightTitle} records the scoped deployment owner.`,
                '',
                '## Scoped Owner',
                ownerCase.rightOwner,
            ].join('\n');
            const leftAtom = makeAtom({
                id: ownerCase.leftDocumentId.replace(/^doc_/, 'atom_'),
                documentId: ownerCase.leftDocumentId,
                sourcePath: ownerCase.leftSourcePath,
                title: ownerCase.leftTitle,
                content: ownerCase.leftOwner,
                keywords: ownerCase.leftKeywords,
            });
            const rightAtom = makeAtom({
                id: ownerCase.rightDocumentId.replace(/^doc_/, 'atom_'),
                documentId: ownerCase.rightDocumentId,
                sourcePath: ownerCase.rightSourcePath,
                title: ownerCase.rightTitle,
                content: ownerCase.rightOwner,
                keywords: ownerCase.rightKeywords,
            });
            const leftItem = makeQueryItem({
                atom: leftAtom,
                evidence: {
                    id: `evidence_${ownerCase.leftDocumentId}`,
                    documentId: leftAtom.documentId,
                    sourcePath: leftAtom.sourcePath,
                    startOffset: leftDocument.indexOf(ownerCase.leftOwner),
                    endOffset: leftDocument.indexOf(ownerCase.leftOwner) + ownerCase.leftOwner.length,
                    startLine: 6,
                    endLine: 6,
                    snippet: ownerCase.leftOwner,
                },
            });
            const rightItem = makeQueryItem({
                atom: rightAtom,
                evidence: {
                    id: `evidence_${ownerCase.rightDocumentId}`,
                    documentId: rightAtom.documentId,
                    sourcePath: rightAtom.sourcePath,
                    startOffset: rightDocument.indexOf(ownerCase.rightOwner),
                    endOffset: rightDocument.indexOf(ownerCase.rightOwner) + ownerCase.rightOwner.length,
                    startLine: 6,
                    endLine: 6,
                    snippet: ownerCase.rightOwner,
                },
            });

            const assembly = await assembleRagEvidenceContext({
                query: ownerCase.query,
                items: [leftItem, rightItem],
                sourceResolver: async (lookup) => ({
                    documentId: lookup.documentId,
                    sourcePath: lookup.sourcePath,
                    content: lookup.documentId === leftAtom.documentId ? leftDocument : rightDocument,
                }),
                paragraphWindow: 5,
                budget: {
                    maxFragments: 10,
                    maxCharsPerFragment: 700,
                    maxTotalChars: 2600,
                },
            });

            expect(assembly.fragments.some((fragment) => fragment.role === 'conflict')).toBe(false);
            expect(assembly.fragments).toEqual(expect.arrayContaining([
                expect.objectContaining({
                    role: 'parent_context',
                    documentId: leftAtom.documentId,
                    sourceBoundary: 'full_document',
                    text: expect.stringContaining(ownerCase.leftOwner),
                }),
                expect.objectContaining({
                    role: 'parent_context',
                    documentId: rightAtom.documentId,
                    sourceBoundary: 'full_document',
                    text: expect.stringContaining(ownerCase.rightOwner),
                }),
            ]));
        }
    });

    test('does not mark condition-scoped quantity facts from different documents as conflicting evidence', async () => {
        const conditionScopedQuantityCases = [
            {
                query: 'compare cross environment staging retry limit source with cross environment production retry limit source',
                leftTitle: 'Cross Environment Staging Retry Limit Source',
                rightTitle: 'Cross Environment Production Retry Limit Source',
                leftDocumentId: 'doc_cross_environment_staging_retry_limit_source',
                rightDocumentId: 'doc_cross_environment_production_retry_limit_source',
                leftSourcePath: 'Knowledge_Base/ragconditionquantitycrossscope/cross environment staging retry limit source.md',
                rightSourcePath: 'Knowledge_Base/ragconditionquantitycrossscope/cross environment production retry limit source.md',
                leftLimit: 'The retry limit is 3 in the staging environment.',
                rightLimit: 'The retry limit is 5 in the production environment.',
                leftKeywords: ['environment', 'staging', 'retry', 'limit'],
                rightKeywords: ['environment', 'production', 'retry', 'limit'],
            },
            {
                query: 'compare cross version one retry limit source with cross version two retry limit source',
                leftTitle: 'Cross Version One Retry Limit Source',
                rightTitle: 'Cross Version Two Retry Limit Source',
                leftDocumentId: 'doc_cross_version_one_retry_limit_source',
                rightDocumentId: 'doc_cross_version_two_retry_limit_source',
                leftSourcePath: 'Knowledge_Base/ragconditionquantitycrossscope/cross version one retry limit source.md',
                rightSourcePath: 'Knowledge_Base/ragconditionquantitycrossscope/cross version two retry limit source.md',
                leftLimit: 'The retry limit is 3 in version 1.0.',
                rightLimit: 'The retry limit is 5 in version 2.0.',
                leftKeywords: ['version', 'one', 'retry', 'limit'],
                rightKeywords: ['version', 'two', 'retry', 'limit'],
            },
            {
                query: 'compare cross platform windows retry limit source with cross platform android retry limit source',
                leftTitle: 'Cross Platform Windows Retry Limit Source',
                rightTitle: 'Cross Platform Android Retry Limit Source',
                leftDocumentId: 'doc_cross_platform_windows_retry_limit_source',
                rightDocumentId: 'doc_cross_platform_android_retry_limit_source',
                leftSourcePath: 'Knowledge_Base/ragconditionquantitycrossscope/cross platform windows retry limit source.md',
                rightSourcePath: 'Knowledge_Base/ragconditionquantitycrossscope/cross platform android retry limit source.md',
                leftLimit: 'The retry limit is 3 on the Windows platform.',
                rightLimit: 'The retry limit is 5 on the Android platform.',
                leftKeywords: ['platform', 'windows', 'retry', 'limit'],
                rightKeywords: ['platform', 'android', 'retry', 'limit'],
            },
        ];

        for (const quantityCase of conditionScopedQuantityCases) {
            const leftDocument = [
                `# ${quantityCase.leftTitle}`,
                '',
                `${quantityCase.leftTitle} records the scoped retry limit.`,
                '',
                '## Scoped Retry Limit',
                quantityCase.leftLimit,
            ].join('\n');
            const rightDocument = [
                `# ${quantityCase.rightTitle}`,
                '',
                `${quantityCase.rightTitle} records the scoped retry limit.`,
                '',
                '## Scoped Retry Limit',
                quantityCase.rightLimit,
            ].join('\n');
            const leftAtom = makeAtom({
                id: quantityCase.leftDocumentId.replace(/^doc_/, 'atom_'),
                documentId: quantityCase.leftDocumentId,
                sourcePath: quantityCase.leftSourcePath,
                title: quantityCase.leftTitle,
                content: quantityCase.leftLimit,
                keywords: quantityCase.leftKeywords,
            });
            const rightAtom = makeAtom({
                id: quantityCase.rightDocumentId.replace(/^doc_/, 'atom_'),
                documentId: quantityCase.rightDocumentId,
                sourcePath: quantityCase.rightSourcePath,
                title: quantityCase.rightTitle,
                content: quantityCase.rightLimit,
                keywords: quantityCase.rightKeywords,
            });
            const leftItem = makeQueryItem({
                atom: leftAtom,
                evidence: {
                    id: `evidence_${quantityCase.leftDocumentId}`,
                    documentId: leftAtom.documentId,
                    sourcePath: leftAtom.sourcePath,
                    startOffset: leftDocument.indexOf(quantityCase.leftLimit),
                    endOffset: leftDocument.indexOf(quantityCase.leftLimit) + quantityCase.leftLimit.length,
                    startLine: 6,
                    endLine: 6,
                    snippet: quantityCase.leftLimit,
                },
            });
            const rightItem = makeQueryItem({
                atom: rightAtom,
                evidence: {
                    id: `evidence_${quantityCase.rightDocumentId}`,
                    documentId: rightAtom.documentId,
                    sourcePath: rightAtom.sourcePath,
                    startOffset: rightDocument.indexOf(quantityCase.rightLimit),
                    endOffset: rightDocument.indexOf(quantityCase.rightLimit) + quantityCase.rightLimit.length,
                    startLine: 6,
                    endLine: 6,
                    snippet: quantityCase.rightLimit,
                },
            });

            const assembly = await assembleRagEvidenceContext({
                query: quantityCase.query,
                items: [leftItem, rightItem],
                sourceResolver: async (lookup) => ({
                    documentId: lookup.documentId,
                    sourcePath: lookup.sourcePath,
                    content: lookup.documentId === leftAtom.documentId ? leftDocument : rightDocument,
                }),
                paragraphWindow: 5,
                budget: {
                    maxFragments: 10,
                    maxCharsPerFragment: 700,
                    maxTotalChars: 2600,
                },
            });

            expect(assembly.fragments.some((fragment) => fragment.role === 'conflict')).toBe(false);
            expect(assembly.fragments).toEqual(expect.arrayContaining([
                expect.objectContaining({
                    role: 'parent_context',
                    documentId: leftAtom.documentId,
                    sourceBoundary: 'full_document',
                    text: expect.stringContaining(quantityCase.leftLimit),
                }),
                expect.objectContaining({
                    role: 'parent_context',
                    documentId: rightAtom.documentId,
                    sourceBoundary: 'full_document',
                    text: expect.stringContaining(quantityCase.rightLimit),
                }),
            ]));
        }
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

    test('marks cross-document unitless quantity facts with plural predicates as conflicting evidence', async () => {
        const nominalAttempts = 'The retry attempts are 3 in the nominal retry record.';
        const fieldAttempts = 'The retry attempts are 5 in the field retry record.';
        const nominalDocument = [
            '# Nominal Retry Attempts Quantity Conflict Probe',
            '',
            'Nominal retry attempts quantity conflict probe provides the nominal-side retry record.',
            '',
            '## Nominal Retry Source',
            nominalAttempts,
            'Operators must compare this source against field evidence before publishing a retry-attempt count.',
        ].join('\n');
        const fieldDocument = [
            '# Field Retry Attempts Quantity Conflict Evidence',
            '',
            'Field retry attempts quantity conflict evidence provides the field-side retry record.',
            '',
            '## Field Retry Source',
            fieldAttempts,
            'Operators must resolve the active retry source before publishing a stable retry-attempt count.',
        ].join('\n');
        const nominalAtom = makeAtom({
            id: 'atom_nominal_retry_attempts_quantity_conflict',
            documentId: 'doc_nominal_retry_attempts_quantity_conflict',
            sourcePath: 'Knowledge_Base/ragquantitymulticonflict/nominal retry attempts quantity conflict probe.md',
            title: 'Nominal Retry Attempts Quantity Conflict Probe',
            content: nominalAttempts,
            keywords: ['retry', 'attempts', 'quantity', 'nominal'],
        });
        const fieldAtom = makeAtom({
            id: 'atom_field_retry_attempts_quantity_conflict',
            documentId: 'doc_field_retry_attempts_quantity_conflict',
            sourcePath: 'Knowledge_Base/ragquantitymulticonflict/field retry attempts quantity conflict evidence.md',
            title: 'Field Retry Attempts Quantity Conflict Evidence',
            content: fieldAttempts,
            keywords: ['retry', 'attempts', 'quantity', 'field'],
        });
        const nominalItem = makeQueryItem({
            atom: nominalAtom,
            evidence: {
                id: 'evidence_nominal_retry_attempts_quantity',
                documentId: nominalAtom.documentId,
                sourcePath: nominalAtom.sourcePath,
                startOffset: nominalDocument.indexOf(nominalAttempts),
                endOffset: nominalDocument.indexOf(nominalAttempts) + nominalAttempts.length,
                startLine: 6,
                endLine: 6,
                snippet: nominalAttempts,
            },
        });
        const fieldItem = makeQueryItem({
            atom: fieldAtom,
            evidence: {
                id: 'evidence_field_retry_attempts_quantity',
                documentId: fieldAtom.documentId,
                sourcePath: fieldAtom.sourcePath,
                startOffset: fieldDocument.indexOf(fieldAttempts),
                endOffset: fieldDocument.indexOf(fieldAttempts) + fieldAttempts.length,
                startLine: 6,
                endLine: 6,
                snippet: fieldAttempts,
            },
        });

        const assembly = await assembleRagEvidenceContext({
            query: 'compare nominal retry attempts quantity conflict probe with field retry attempts quantity conflict evidence',
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
                'evidence_nominal_retry_attempts_quantity',
                'evidence_field_retry_attempts_quantity',
            ]),
            text: expect.stringContaining('across documents'),
        }));
        expect(conflictFragment?.text).toContain('Nominal Retry Attempts Quantity Conflict Probe');
        expect(conflictFragment?.text).toContain('Field Retry Attempts Quantity Conflict Evidence');
        expect(conflictFragment?.text).toContain(nominalAttempts);
        expect(conflictFragment?.text).toContain(fieldAttempts);
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

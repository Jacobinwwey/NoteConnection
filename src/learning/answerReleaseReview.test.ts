import { reviewAnswerRelease } from './answerReleaseReview';
import type {
    AgentConversationGraphContext,
    AgentConversationKnowledgePoint,
    KnowledgeCitation,
    KnowledgeQueryResolvedScope,
} from './types';

const scopedWaterglass: KnowledgeQueryResolvedScope = {
    source: 'scoped',
    workspaceId: 'waterglass',
    corpusId: 'waterglass',
    documentIds: ['doc_water_glass'],
    atomIds: [],
    sourcePathPrefixes: ['Knowledge_Base/waterglass'],
    languages: [],
    matchedAtomCount: 0,
    readiness: {
        status: 'ready',
        message: 'The scoped learning workspace is ready.',
        workspaceId: 'waterglass',
        corpusId: 'waterglass',
        activeResourceCount: 1,
        activeProjectionCount: 1,
        indexedUnitCount: 1,
        indexedSegmentCount: 4,
        matchedDocumentCount: 1,
    },
    missDiagnostics: {
        reason: 'retrieval_candidates_below_threshold',
        message: 'The planner found likely documents, but retrieval did not return evidence-bearing candidates.',
        query: '什么是waterglass?',
        normalizedQuery: '什么是waterglass?',
        plannerQuery: '什么是water glass',
        titleLikeQueries: ['waterglass', 'water glass'],
        titleHitDocumentIds: ['doc_water_glass'],
        indexedScopeAtomCount: 4,
    },
};

function makeKnowledgePoint(overrides: Partial<AgentConversationKnowledgePoint> = {}): AgentConversationKnowledgePoint {
    const citation: KnowledgeCitation = {
        citationId: 'citation_water_glass',
        atomId: 'atom_water_glass',
        documentId: 'doc_water_glass',
        sourcePath: 'Knowledge_Base/waterglass/water-glass.md',
        title: 'Water Glass',
        snippet: 'Water glass is a transparent container filled with water.',
        startLine: 3,
        endLine: 3,
        score: 0.92,
    };
    return {
        atomId: 'atom_water_glass',
        atomIds: ['atom_water_glass'],
        documentId: 'doc_water_glass',
        sourcePath: 'Knowledge_Base/waterglass/water-glass.md',
        title: 'Water Glass',
        summary: 'Water glass is a transparent container filled with water.',
        evidenceSnippet: 'Water glass is a transparent container filled with water.',
        score: 0.92,
        citation,
        citations: [citation],
        matchedSpans: [],
        matchCount: 1,
        relationPath: [],
        relationPathAtomIds: [],
        relationKinds: [],
        temporalValidity: {
            isValid: true,
            checkedAt: '2026-06-18T00:00:00.000Z',
            reasons: [],
            details: [],
        },
        capabilities: [],
        ...overrides,
    };
}

function makeGraphContext(): AgentConversationGraphContext {
    return {
        anchorAtomId: 'atom_water_glass',
        anchorTitle: 'Water Glass',
        supportingAtomIds: [],
        supportingTitles: [],
        relationKinds: [],
        relationSummaries: [],
        temporalValidity: {
            checkedAt: '2026-06-18T00:00:00.000Z',
            allPointsValid: true,
            warningReasons: [],
            invalidKnowledgePointTitles: [],
            edgeKinds: [],
            details: [],
        },
    };
}

describe('answerReleaseReview', () => {
    test('downgrades unsupported debug-style answers into concise abstentions', () => {
        const review = reviewAnswerRelease({
            message: '什么是waterglass?',
            draftAnswer: 'No scoped knowledge points matched "什么是waterglass?". The planner found likely documents, but retrieval did not return evidence-bearing candidates.',
            knowledgePoints: [],
            citations: [],
            usedScope: scopedWaterglass,
            graphContext: null,
            reviewedAt: '2026-06-18T09:00:00.000Z',
        });

        expect(review.decision).toBe('abstain');
        expect(review.publicAnswer).toContain('waterglass');
        expect(review.publicAnswer).toContain('当前范围');
        expect(review.publicAnswer).not.toContain('No scoped knowledge points matched');
        expect(review.publicAnswer).not.toContain('retrieval');
        expect(review.failedGateIds).toEqual(expect.arrayContaining([
            'evidence_sufficiency',
            'internal_diagnostic_leakage',
        ]));
        expect(review.gates).toEqual(expect.arrayContaining([
            expect.objectContaining({
                gateId: 'abstention_hygiene',
                passed: true,
            }),
        ]));
    });

    test('revises grounded answers when draft text leaks support framing', () => {
        const review = reviewAnswerRelease({
            message: 'what is water glass',
            draftAnswer: 'Grounded by 1 citation. Water glass is a transparent container filled with water.',
            knowledgePoints: [makeKnowledgePoint()],
            citations: [makeKnowledgePoint().citation as KnowledgeCitation],
            usedScope: scopedWaterglass,
            graphContext: makeGraphContext(),
            reviewedAt: '2026-06-18T09:05:00.000Z',
        });

        expect(review.decision).toBe('revise');
        expect(review.publicAnswer).toBe('Water glass is a transparent container filled with water.');
        expect(review.failedGateIds).toContain('public_surface_contraction');
        expect(review.leakedInternalFragments).toHaveLength(0);
    });

    test('revises grounded answers when draft claims drift away from cited support', () => {
        const review = reviewAnswerRelease({
            message: 'what is water glass',
            draftAnswer: 'Water glass is a copper energy-storage device used for industrial voltage buffering.',
            knowledgePoints: [makeKnowledgePoint()],
            citations: [makeKnowledgePoint().citation as KnowledgeCitation],
            usedScope: scopedWaterglass,
            graphContext: makeGraphContext(),
            reviewedAt: '2026-06-18T09:10:00.000Z',
        });

        expect(review.decision).toBe('revise');
        expect(review.failedGateIds).toContain('claim_grounding_alignment');
        expect(review.publicAnswer).toBe('Water glass is a transparent container filled with water.');
        expect(review.gates).toEqual(expect.arrayContaining([
            expect.objectContaining({
                gateId: 'claim_grounding_alignment',
                passed: false,
            }),
        ]));
    });

    test('revises grounded answers when structured numeric facts conflict with support', () => {
        const densityPoint = makeKnowledgePoint({
            title: 'Water Density',
            summary: 'Water density is 999.8 kg/m3 at STP.',
            evidenceSnippet: 'Water density is 999.8 kg/m3 at STP.',
            citation: {
                ...(makeKnowledgePoint().citation as KnowledgeCitation),
                title: 'Water Density',
                snippet: 'Water density is 999.8 kg/m3 at STP.',
            },
            citations: [
                {
                    ...(makeKnowledgePoint().citation as KnowledgeCitation),
                    title: 'Water Density',
                    snippet: 'Water density is 999.8 kg/m3 at STP.',
                },
            ],
        });
        const review = reviewAnswerRelease({
            message: 'what is the density of water',
            draftAnswer: 'Water density is 875 kg/m3 at STP.',
            knowledgePoints: [densityPoint],
            citations: [densityPoint.citation as KnowledgeCitation],
            usedScope: scopedWaterglass,
            graphContext: makeGraphContext(),
            reviewedAt: '2026-06-19T00:10:00.000Z',
        });

        expect(review.decision).toBe('revise');
        expect(review.failedGateIds).toContain('claim_structured_consistency');
        expect(review.publicAnswer).toBe('Water density is 999.8 kg/m3 at STP.');
        expect(review.gates).toEqual(expect.arrayContaining([
            expect.objectContaining({
                gateId: 'claim_structured_consistency',
                passed: false,
            }),
        ]));
    });

    test('keeps grounded answers when one of several supported structured values matches', () => {
        const tablePoint = makeKnowledgePoint({
            title: 'Water Density Table',
            summary: 'Reference values: glass density 2500 kg/m3; water density 999.8 kg/m3.',
            evidenceSnippet: 'Reference values: glass density 2500 kg/m3; water density 999.8 kg/m3.',
            citation: {
                ...(makeKnowledgePoint().citation as KnowledgeCitation),
                title: 'Water Density Table',
                snippet: 'Reference values: glass density 2500 kg/m3; water density 999.8 kg/m3.',
            },
            citations: [
                {
                    ...(makeKnowledgePoint().citation as KnowledgeCitation),
                    title: 'Water Density Table',
                    snippet: 'Reference values: glass density 2500 kg/m3; water density 999.8 kg/m3.',
                },
            ],
        });
        const review = reviewAnswerRelease({
            message: 'what is the density of water',
            draftAnswer: 'Water density is 999.8 kg/m3.',
            knowledgePoints: [tablePoint],
            citations: [tablePoint.citation as KnowledgeCitation],
            usedScope: scopedWaterglass,
            graphContext: makeGraphContext(),
            reviewedAt: '2026-06-19T00:20:00.000Z',
        });

        expect(review.decision).toBe('release');
        expect(review.failedGateIds).not.toContain('claim_structured_consistency');
        expect(review.publicAnswer).toBe('Water density is 999.8 kg/m3.');
        expect(review.gates).toEqual(expect.arrayContaining([
            expect.objectContaining({
                gateId: 'claim_structured_consistency',
                passed: true,
            }),
        ]));
    });

    test('revises grounded answers when year claims conflict with support', () => {
        const yearPoint = makeKnowledgePoint({
            title: 'Glass-Steagall Act',
            summary: 'The Glass-Steagall Act was enacted in 1933.',
            evidenceSnippet: 'The Glass-Steagall Act was enacted in 1933.',
            citation: {
                ...(makeKnowledgePoint().citation as KnowledgeCitation),
                title: 'Glass-Steagall Act',
                snippet: 'The Glass-Steagall Act was enacted in 1933.',
            },
            citations: [
                {
                    ...(makeKnowledgePoint().citation as KnowledgeCitation),
                    title: 'Glass-Steagall Act',
                    snippet: 'The Glass-Steagall Act was enacted in 1933.',
                },
            ],
        });
        const review = reviewAnswerRelease({
            message: 'when was the Glass-Steagall Act enacted',
            draftAnswer: 'The Glass-Steagall Act was enacted in 1935.',
            knowledgePoints: [yearPoint],
            citations: [yearPoint.citation as KnowledgeCitation],
            usedScope: scopedWaterglass,
            graphContext: makeGraphContext(),
            reviewedAt: '2026-06-19T00:30:00.000Z',
        });

        expect(review.decision).toBe('revise');
        expect(review.failedGateIds).toContain('claim_structured_consistency');
        expect(review.publicAnswer).toBe('The Glass-Steagall Act was enacted in 1933.');
    });
});

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

function makeOrderedGraphContext(overrides: Partial<AgentConversationGraphContext> = {}): AgentConversationGraphContext {
    return {
        anchorAtomId: 'atom_ground_state',
        anchorTitle: 'Ground State',
        supportingAtomIds: ['atom_bridge_layer'],
        supportingTitles: ['Bridge Layer'],
        relationKinds: ['prerequisite'],
        relationSummaries: [
            {
                relationKind: 'prerequisite',
                edgeIds: ['edge_bridge_to_ground'],
                sourceAtomIds: ['atom_bridge_layer'],
                targetAtomIds: ['atom_ground_state'],
                averageConfidence: 0.93,
            },
        ],
        connectionPaths: [
            {
                sourceAtomId: 'atom_bridge_layer',
                sourceTitle: 'Bridge Layer',
                targetAtomId: 'atom_ground_state',
                targetTitle: 'Ground State',
                pathAtomIds: ['atom_bridge_layer', 'atom_ground_state'],
                pathTitles: ['Bridge Layer', 'Ground State'],
                pathEdges: [
                    {
                        fromAtomId: 'atom_bridge_layer',
                        toAtomId: 'atom_ground_state',
                        relationKind: 'prerequisite',
                    },
                ],
                length: 1,
            },
        ],
        predecessorWindow: [
            {
                atomId: 'atom_bridge_layer',
                title: 'Bridge Layer',
                relationKind: 'prerequisite',
                confidence: 0.93,
            },
        ],
        successorWindow: [],
        temporalValidity: {
            checkedAt: '2026-06-19T02:00:00.000Z',
            allPointsValid: true,
            warningReasons: [],
            invalidKnowledgePointTitles: [],
            edgeKinds: [],
            details: [],
        },
        ...overrides,
    };
}

function makeComparisonGraphContext(
    relationKind: 'contrast' | 'analogy',
    leftTitle: string,
    rightTitle: string,
    overrides: Partial<AgentConversationGraphContext> = {}
): AgentConversationGraphContext {
    return {
        anchorAtomId: 'atom_left',
        anchorTitle: leftTitle,
        supportingAtomIds: ['atom_right'],
        supportingTitles: [rightTitle],
        relationKinds: [relationKind],
        relationSummaries: [
            {
                relationKind,
                edgeIds: ['edge_graph_comparison'],
                sourceAtomIds: ['atom_left'],
                targetAtomIds: ['atom_right'],
                averageConfidence: 0.91,
            },
        ],
        knowledgePointRelations: [
            {
                edgeId: 'edge_graph_comparison',
                relationKind,
                sourceAtomId: 'atom_left',
                sourceTitle: leftTitle,
                targetAtomId: 'atom_right',
                targetTitle: rightTitle,
                confidence: 0.91,
            },
        ],
        connectionPaths: [
            {
                sourceAtomId: 'atom_left',
                sourceTitle: leftTitle,
                targetAtomId: 'atom_right',
                targetTitle: rightTitle,
                pathAtomIds: ['atom_left', 'atom_right'],
                pathTitles: [leftTitle, rightTitle],
                pathEdges: [
                    {
                        fromAtomId: 'atom_left',
                        toAtomId: 'atom_right',
                        relationKind,
                    },
                ],
                length: 1,
            },
        ],
        predecessorWindow: [],
        successorWindow: [],
        temporalValidity: {
            checkedAt: '2026-06-19T03:40:00.000Z',
            allPointsValid: true,
            warningReasons: [],
            invalidKnowledgePointTitles: [],
            edgeKinds: [],
            details: [],
        },
        ...overrides,
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

    test('revises definition-query answers when the draft describes the document instead of the concept', () => {
        const point = makeKnowledgePoint({
            title: 'Water Glass',
            summary: 'This technical document analyzes water glass as a physical system. Water glass is a transparent container filled with water.',
            evidenceSnippet: 'This technical document analyzes water glass as a physical system. Water glass is a transparent container filled with water.',
            citation: {
                ...(makeKnowledgePoint().citation as KnowledgeCitation),
                title: 'Water Glass',
                snippet: 'This technical document analyzes water glass as a physical system. Water glass is a transparent container filled with water.',
            },
            citations: [
                {
                    ...(makeKnowledgePoint().citation as KnowledgeCitation),
                    title: 'Water Glass',
                    snippet: 'This technical document analyzes water glass as a physical system. Water glass is a transparent container filled with water.',
                },
            ],
        });
        const review = reviewAnswerRelease({
            message: 'what is water glass',
            draftAnswer: 'This technical document analyzes water glass as a physical system.',
            knowledgePoints: [point],
            citations: [point.citation as KnowledgeCitation],
            usedScope: scopedWaterglass,
            graphContext: makeGraphContext(),
            reviewedAt: '2026-06-19T00:05:00.000Z',
        });

        expect(review.decision).toBe('revise');
        expect(review.failedGateIds).toContain('query_intent_alignment');
        expect(review.publicAnswer).toBe('Water Glass is a transparent container filled with water.');
        expect(review.gates).toEqual(expect.arrayContaining([
            expect.objectContaining({
                gateId: 'query_intent_alignment',
                passed: false,
            }),
        ]));
    });

    test('revises Chinese definition-query answers when the draft only repeats document framing', () => {
        const point = makeKnowledgePoint({
            title: '水杯 (water glass)',
            summary: '本技术文档旨在对“水杯”这一系统进行全面的科学分析。此处的“水杯”被定义为一个由特定流体（水）和透明非晶态固体容器（玻璃杯）组成的物理系统。',
            evidenceSnippet: '本技术文档旨在对“水杯”这一系统进行全面的科学分析。此处的“水杯”被定义为一个由特定流体（水）和透明非晶态固体容器（玻璃杯）组成的物理系统。',
            citation: {
                ...(makeKnowledgePoint().citation as KnowledgeCitation),
                title: '水杯 (water glass)',
                snippet: '本技术文档旨在对“水杯”这一系统进行全面的科学分析。此处的“水杯”被定义为一个由特定流体（水）和透明非晶态固体容器（玻璃杯）组成的物理系统。',
            },
            citations: [
                {
                    ...(makeKnowledgePoint().citation as KnowledgeCitation),
                    title: '水杯 (water glass)',
                    snippet: '本技术文档旨在对“水杯”这一系统进行全面的科学分析。此处的“水杯”被定义为一个由特定流体（水）和透明非晶态固体容器（玻璃杯）组成的物理系统。',
                },
            ],
        });
        const review = reviewAnswerRelease({
            message: '什么是waterglass?',
            draftAnswer: '水杯 (water glass) 本技术文档旨在对“水杯”这一系统进行全面的科学分析。',
            knowledgePoints: [point],
            citations: [point.citation as KnowledgeCitation],
            usedScope: scopedWaterglass,
            graphContext: makeGraphContext(),
            reviewedAt: '2026-06-19T00:07:00.000Z',
        });

        expect(review.decision).toBe('revise');
        expect(review.failedGateIds).toContain('query_intent_alignment');
        expect(review.publicAnswer).toBe('水杯 (water glass) 是一个由特定流体（水）和透明非晶态固体容器（玻璃杯）组成的物理系统。');
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

    test('revises grounded answers when the subject changes but the supported fact tail stays the same', () => {
        const point = makeKnowledgePoint({
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
            draftAnswer: 'Glass density is 999.8 kg/m3 at STP.',
            knowledgePoints: [point],
            citations: [point.citation as KnowledgeCitation],
            usedScope: scopedWaterglass,
            graphContext: makeGraphContext(),
            reviewedAt: '2026-06-19T02:00:00.000Z',
        });

        expect(review.decision).toBe('revise');
        expect(review.failedGateIds).toContain('claim_subject_consistency');
        expect(review.publicAnswer).toBe('Water density is 999.8 kg/m3 at STP.');
        expect(review.gates).toEqual(expect.arrayContaining([
            expect.objectContaining({
                gateId: 'claim_subject_consistency',
                passed: false,
            }),
        ]));
    });

    test('does not raise a subject conflict when the supported subject and draft subject are still the same entity', () => {
        const point = makeKnowledgePoint({
            title: 'Water Glass',
            summary: 'Water glass is a transparent container filled with water.',
            evidenceSnippet: 'Water glass is a transparent container filled with water.',
            citation: {
                ...(makeKnowledgePoint().citation as KnowledgeCitation),
                title: 'Water Glass',
                snippet: 'Water glass is a transparent container filled with water.',
            },
            citations: [
                {
                    ...(makeKnowledgePoint().citation as KnowledgeCitation),
                    title: 'Water Glass',
                    snippet: 'Water glass is a transparent container filled with water.',
                },
            ],
        });
        const review = reviewAnswerRelease({
            message: 'what is water glass',
            draftAnswer: 'A water glass is a transparent container filled with water.',
            knowledgePoints: [point],
            citations: [point.citation as KnowledgeCitation],
            usedScope: scopedWaterglass,
            graphContext: makeGraphContext(),
            reviewedAt: '2026-06-19T02:05:00.000Z',
        });

        expect(review.decision).toBe('release');
        expect(review.failedGateIds).not.toContain('claim_subject_consistency');
        expect(review.gates).toEqual(expect.arrayContaining([
            expect.objectContaining({
                gateId: 'claim_subject_consistency',
                passed: true,
            }),
        ]));
    });

    test('revises grounded answers when same-subject attribute claims conflict with cited support', () => {
        const point = makeKnowledgePoint({
            title: 'Water Glass',
            summary: 'Water glass has moderate thermal insulation.',
            evidenceSnippet: 'Water glass has moderate thermal insulation.',
            citation: {
                ...(makeKnowledgePoint().citation as KnowledgeCitation),
                title: 'Water Glass',
                snippet: 'Water glass has moderate thermal insulation.',
            },
            citations: [
                {
                    ...(makeKnowledgePoint().citation as KnowledgeCitation),
                    title: 'Water Glass',
                    snippet: 'Water glass has moderate thermal insulation.',
                },
            ],
        });
        const review = reviewAnswerRelease({
            message: 'What thermal insulation does water glass have?',
            draftAnswer: 'Water glass has high thermal insulation.',
            knowledgePoints: [point],
            citations: [point.citation as KnowledgeCitation],
            usedScope: scopedWaterglass,
            graphContext: makeGraphContext(),
            reviewedAt: '2026-06-19T02:20:00.000Z',
        });

        expect(review.decision).toBe('revise');
        expect(review.failedGateIds).toContain('claim_attribute_consistency');
        expect(review.publicAnswer).toBe('Water glass has moderate thermal insulation.');
        expect(review.gates).toEqual(expect.arrayContaining([
            expect.objectContaining({
                gateId: 'claim_attribute_consistency',
                passed: false,
            }),
        ]));
    });

    test('revises grounded answers when Chinese same-subject attribute claims conflict with cited support', () => {
        const point = makeKnowledgePoint({
            title: '水杯',
            summary: '水杯具有中等热绝缘性能。',
            evidenceSnippet: '水杯具有中等热绝缘性能。',
            citation: {
                ...(makeKnowledgePoint().citation as KnowledgeCitation),
                title: '水杯',
                snippet: '水杯具有中等热绝缘性能。',
            },
            citations: [
                {
                    ...(makeKnowledgePoint().citation as KnowledgeCitation),
                    title: '水杯',
                    snippet: '水杯具有中等热绝缘性能。',
                },
            ],
        });
        const review = reviewAnswerRelease({
            message: '水杯有什么热绝缘性能？',
            draftAnswer: '水杯具有高热绝缘性能。',
            knowledgePoints: [point],
            citations: [point.citation as KnowledgeCitation],
            usedScope: scopedWaterglass,
            graphContext: makeGraphContext(),
            reviewedAt: '2026-06-19T02:25:00.000Z',
        });

        expect(review.decision).toBe('revise');
        expect(review.failedGateIds).toContain('claim_attribute_consistency');
        expect(review.publicAnswer).toBe('水杯具有中等热绝缘性能。');
        expect(review.gates).toEqual(expect.arrayContaining([
            expect.objectContaining({
                gateId: 'claim_attribute_consistency',
                passed: false,
            }),
        ]));
    });

    test('does not raise an attribute conflict when the draft is a compatible refinement of the supported attribute', () => {
        const point = makeKnowledgePoint({
            title: 'Water Glass',
            summary: 'Water glass has a transparent glass wall.',
            evidenceSnippet: 'Water glass has a transparent glass wall.',
            citation: {
                ...(makeKnowledgePoint().citation as KnowledgeCitation),
                title: 'Water Glass',
                snippet: 'Water glass has a transparent glass wall.',
            },
            citations: [
                {
                    ...(makeKnowledgePoint().citation as KnowledgeCitation),
                    title: 'Water Glass',
                    snippet: 'Water glass has a transparent glass wall.',
                },
            ],
        });
        const review = reviewAnswerRelease({
            message: 'What wall does the water glass have?',
            draftAnswer: 'Water glass has a transparent wall.',
            knowledgePoints: [point],
            citations: [point.citation as KnowledgeCitation],
            usedScope: scopedWaterglass,
            graphContext: makeGraphContext(),
            reviewedAt: '2026-06-19T02:30:00.000Z',
        });

        expect(review.decision).toBe('release');
        expect(review.failedGateIds).not.toContain('claim_attribute_consistency');
        expect(review.gates).toEqual(expect.arrayContaining([
            expect.objectContaining({
                gateId: 'claim_attribute_consistency',
                passed: true,
            }),
        ]));
    });

    test('revises grounded answers when containment relations conflict with cited support', () => {
        const point = makeKnowledgePoint({
            title: 'Water Glass Contents',
            summary: 'Water glass contains water during the example setup.',
            evidenceSnippet: 'Water glass contains water during the example setup.',
            citation: {
                ...(makeKnowledgePoint().citation as KnowledgeCitation),
                title: 'Water Glass Contents',
                snippet: 'Water glass contains water during the example setup.',
            },
            citations: [
                {
                    ...(makeKnowledgePoint().citation as KnowledgeCitation),
                    title: 'Water Glass Contents',
                    snippet: 'Water glass contains water during the example setup.',
                },
            ],
        });
        const review = reviewAnswerRelease({
            message: 'what does the example water glass contain',
            draftAnswer: 'Water glass contains oil during the example setup.',
            knowledgePoints: [point],
            citations: [point.citation as KnowledgeCitation],
            usedScope: scopedWaterglass,
            graphContext: makeGraphContext(),
            reviewedAt: '2026-06-19T03:00:00.000Z',
        });

        expect(review.decision).toBe('revise');
        expect(review.failedGateIds).toContain('claim_containment_consistency');
        expect(review.publicAnswer).toBe('Water Glass Contents: Water glass contains water during the example setup.');
        expect(review.gates).toEqual(expect.arrayContaining([
            expect.objectContaining({
                gateId: 'claim_containment_consistency',
                passed: false,
            }),
        ]));
    });

    test('revises grounded answers when Chinese containment relations conflict with cited support', () => {
        const point = makeKnowledgePoint({
            title: '水杯内容物',
            summary: '水杯盛有清水。',
            evidenceSnippet: '水杯盛有清水。',
            citation: {
                ...(makeKnowledgePoint().citation as KnowledgeCitation),
                title: '水杯内容物',
                snippet: '水杯盛有清水。',
            },
            citations: [
                {
                    ...(makeKnowledgePoint().citation as KnowledgeCitation),
                    title: '水杯内容物',
                    snippet: '水杯盛有清水。',
                },
            ],
        });
        const review = reviewAnswerRelease({
            message: '水杯里装的是什么？',
            draftAnswer: '水杯盛有机油。',
            knowledgePoints: [point],
            citations: [point.citation as KnowledgeCitation],
            usedScope: scopedWaterglass,
            graphContext: makeGraphContext(),
            reviewedAt: '2026-06-19T03:05:00.000Z',
        });

        expect(review.decision).toBe('revise');
        expect(review.failedGateIds).toContain('claim_containment_consistency');
        expect(review.publicAnswer).toBe('水杯内容物: 水杯盛有清水。');
        expect(review.gates).toEqual(expect.arrayContaining([
            expect.objectContaining({
                gateId: 'claim_containment_consistency',
                passed: false,
            }),
        ]));
    });

    test('does not raise a containment conflict when the draft is a compatible refinement of the supported content', () => {
        const point = makeKnowledgePoint({
            title: 'Water Glass Contents',
            summary: 'Water glass contains water.',
            evidenceSnippet: 'Water glass contains water.',
            citation: {
                ...(makeKnowledgePoint().citation as KnowledgeCitation),
                title: 'Water Glass Contents',
                snippet: 'Water glass contains water.',
            },
            citations: [
                {
                    ...(makeKnowledgePoint().citation as KnowledgeCitation),
                    title: 'Water Glass Contents',
                    snippet: 'Water glass contains water.',
                },
            ],
        });
        const review = reviewAnswerRelease({
            message: 'what does water glass contain',
            draftAnswer: 'Water glass contains cold water.',
            knowledgePoints: [point],
            citations: [point.citation as KnowledgeCitation],
            usedScope: scopedWaterglass,
            graphContext: makeGraphContext(),
            reviewedAt: '2026-06-19T03:10:00.000Z',
        });

        expect(review.decision).toBe('release');
        expect(review.failedGateIds).not.toContain('claim_containment_consistency');
        expect(review.gates).toEqual(expect.arrayContaining([
            expect.objectContaining({
                gateId: 'claim_containment_consistency',
                passed: true,
            }),
        ]));
    });

    test('revises grounded answers when composition claims conflict with cited support', () => {
        const point = makeKnowledgePoint({
            title: 'Water Glass Composition',
            summary: 'Water glass is composed of water and a transparent glass cup.',
            evidenceSnippet: 'Water glass is composed of water and a transparent glass cup.',
            citation: {
                ...(makeKnowledgePoint().citation as KnowledgeCitation),
                title: 'Water Glass Composition',
                snippet: 'Water glass is composed of water and a transparent glass cup.',
            },
            citations: [
                {
                    ...(makeKnowledgePoint().citation as KnowledgeCitation),
                    title: 'Water Glass Composition',
                    snippet: 'Water glass is composed of water and a transparent glass cup.',
                },
            ],
        });
        const review = reviewAnswerRelease({
            message: 'what is water glass made of',
            draftAnswer: 'Water glass is composed of oil and a plastic cup.',
            knowledgePoints: [point],
            citations: [point.citation as KnowledgeCitation],
            usedScope: scopedWaterglass,
            graphContext: makeGraphContext(),
            reviewedAt: '2026-06-19T04:00:00.000Z',
        });

        expect(review.decision).toBe('revise');
        expect(review.failedGateIds).toContain('claim_composition_consistency');
        expect(review.publicAnswer).toBe('Water Glass Composition: Water glass is composed of water and a transparent glass cup.');
        expect(review.gates).toEqual(expect.arrayContaining([
            expect.objectContaining({
                gateId: 'claim_composition_consistency',
                passed: false,
            }),
        ]));
    });

    test('revises grounded answers when Chinese composition claims conflict with cited support', () => {
        const point = makeKnowledgePoint({
            title: '水杯组成',
            summary: '水杯由水和玻璃杯组成。',
            evidenceSnippet: '水杯由水和玻璃杯组成。',
            citation: {
                ...(makeKnowledgePoint().citation as KnowledgeCitation),
                title: '水杯组成',
                snippet: '水杯由水和玻璃杯组成。',
            },
            citations: [
                {
                    ...(makeKnowledgePoint().citation as KnowledgeCitation),
                    title: '水杯组成',
                    snippet: '水杯由水和玻璃杯组成。',
                },
            ],
        });
        const review = reviewAnswerRelease({
            message: '水杯由什么组成？',
            draftAnswer: '水杯由机油和塑料杯组成。',
            knowledgePoints: [point],
            citations: [point.citation as KnowledgeCitation],
            usedScope: scopedWaterglass,
            graphContext: makeGraphContext(),
            reviewedAt: '2026-06-19T04:05:00.000Z',
        });

        expect(review.decision).toBe('revise');
        expect(review.failedGateIds).toContain('claim_composition_consistency');
        expect(review.publicAnswer).toBe('水杯组成: 水杯由水和玻璃杯组成。');
        expect(review.gates).toEqual(expect.arrayContaining([
            expect.objectContaining({
                gateId: 'claim_composition_consistency',
                passed: false,
            }),
        ]));
    });

    test('does not raise a composition conflict when the draft keeps the supported components in a compatible order', () => {
        const point = makeKnowledgePoint({
            title: 'Water Glass Composition',
            summary: 'Water glass consists of water and a transparent glass cup.',
            evidenceSnippet: 'Water glass consists of water and a transparent glass cup.',
            citation: {
                ...(makeKnowledgePoint().citation as KnowledgeCitation),
                title: 'Water Glass Composition',
                snippet: 'Water glass consists of water and a transparent glass cup.',
            },
            citations: [
                {
                    ...(makeKnowledgePoint().citation as KnowledgeCitation),
                    title: 'Water Glass Composition',
                    snippet: 'Water glass consists of water and a transparent glass cup.',
                },
            ],
        });
        const review = reviewAnswerRelease({
            message: 'what is water glass composed of',
            draftAnswer: 'Water glass is composed of a glass cup and water.',
            knowledgePoints: [point],
            citations: [point.citation as KnowledgeCitation],
            usedScope: scopedWaterglass,
            graphContext: makeGraphContext(),
            reviewedAt: '2026-06-19T04:10:00.000Z',
        });

        expect(review.decision).toBe('release');
        expect(review.failedGateIds).not.toContain('claim_composition_consistency');
        expect(review.gates).toEqual(expect.arrayContaining([
            expect.objectContaining({
                gateId: 'claim_composition_consistency',
                passed: true,
            }),
        ]));
    });

    test('revises grounded answers when purpose claims conflict with cited support', () => {
        const point = makeKnowledgePoint({
            title: 'Water Glass Purpose',
            summary: 'Water glass is used for drinking water and serving cold water.',
            evidenceSnippet: 'Water glass is used for drinking water and serving cold water.',
            citation: {
                ...(makeKnowledgePoint().citation as KnowledgeCitation),
                title: 'Water Glass Purpose',
                snippet: 'Water glass is used for drinking water and serving cold water.',
            },
            citations: [
                {
                    ...(makeKnowledgePoint().citation as KnowledgeCitation),
                    title: 'Water Glass Purpose',
                    snippet: 'Water glass is used for drinking water and serving cold water.',
                },
            ],
        });
        const review = reviewAnswerRelease({
            message: 'what is water glass used for',
            draftAnswer: 'Water glass is used for storing motor oil.',
            knowledgePoints: [point],
            citations: [point.citation as KnowledgeCitation],
            usedScope: scopedWaterglass,
            graphContext: makeGraphContext(),
            reviewedAt: '2026-06-19T04:15:00.000Z',
        });

        expect(review.decision).toBe('revise');
        expect(review.failedGateIds).toContain('claim_purpose_consistency');
        expect(review.publicAnswer).toBe('Water Glass Purpose: Water glass is used for drinking water and serving cold water.');
        expect(review.gates).toEqual(expect.arrayContaining([
            expect.objectContaining({
                gateId: 'claim_purpose_consistency',
                passed: false,
            }),
        ]));
    });

    test('revises grounded answers when Chinese purpose claims conflict with cited support', () => {
        const point = makeKnowledgePoint({
            title: '水杯用途',
            summary: '水杯用于饮水和盛放冷水。',
            evidenceSnippet: '水杯用于饮水和盛放冷水。',
            citation: {
                ...(makeKnowledgePoint().citation as KnowledgeCitation),
                title: '水杯用途',
                snippet: '水杯用于饮水和盛放冷水。',
            },
            citations: [
                {
                    ...(makeKnowledgePoint().citation as KnowledgeCitation),
                    title: '水杯用途',
                    snippet: '水杯用于饮水和盛放冷水。',
                },
            ],
        });
        const review = reviewAnswerRelease({
            message: '水杯有什么用途？',
            draftAnswer: '水杯用于储存机油。',
            knowledgePoints: [point],
            citations: [point.citation as KnowledgeCitation],
            usedScope: scopedWaterglass,
            graphContext: makeGraphContext(),
            reviewedAt: '2026-06-19T04:20:00.000Z',
        });

        expect(review.decision).toBe('revise');
        expect(review.failedGateIds).toContain('claim_purpose_consistency');
        expect(review.publicAnswer).toBe('水杯用途: 水杯用于饮水和盛放冷水。');
        expect(review.gates).toEqual(expect.arrayContaining([
            expect.objectContaining({
                gateId: 'claim_purpose_consistency',
                passed: false,
            }),
        ]));
    });

    test('does not raise a purpose conflict when the draft keeps a supported purpose refinement', () => {
        const point = makeKnowledgePoint({
            title: 'Water Glass Purpose',
            summary: 'Water glass is used for drinking water and serving cold water.',
            evidenceSnippet: 'Water glass is used for drinking water and serving cold water.',
            citation: {
                ...(makeKnowledgePoint().citation as KnowledgeCitation),
                title: 'Water Glass Purpose',
                snippet: 'Water glass is used for drinking water and serving cold water.',
            },
            citations: [
                {
                    ...(makeKnowledgePoint().citation as KnowledgeCitation),
                    title: 'Water Glass Purpose',
                    snippet: 'Water glass is used for drinking water and serving cold water.',
                },
            ],
        });
        const review = reviewAnswerRelease({
            message: 'what is water glass used for',
            draftAnswer: 'Water glass is used for serving cold water.',
            knowledgePoints: [point],
            citations: [point.citation as KnowledgeCitation],
            usedScope: scopedWaterglass,
            graphContext: makeGraphContext(),
            reviewedAt: '2026-06-19T04:25:00.000Z',
        });

        expect(review.decision).toBe('release');
        expect(review.failedGateIds).not.toContain('claim_purpose_consistency');
        expect(review.gates).toEqual(expect.arrayContaining([
            expect.objectContaining({
                gateId: 'claim_purpose_consistency',
                passed: true,
            }),
        ]));
    });

    test('revises grounded answers when dependency claims conflict with cited support', () => {
        const point = makeKnowledgePoint({
            title: 'Response Validation Dependencies',
            summary: 'Response Validation depends on Baseline Measurement and Sensor Calibration.',
            evidenceSnippet: 'Response Validation depends on Baseline Measurement and Sensor Calibration.',
            citation: {
                ...(makeKnowledgePoint().citation as KnowledgeCitation),
                title: 'Response Validation Dependencies',
                snippet: 'Response Validation depends on Baseline Measurement and Sensor Calibration.',
            },
            citations: [
                {
                    ...(makeKnowledgePoint().citation as KnowledgeCitation),
                    title: 'Response Validation Dependencies',
                    snippet: 'Response Validation depends on Baseline Measurement and Sensor Calibration.',
                },
            ],
        });
        const review = reviewAnswerRelease({
            message: 'What does response validation depend on?',
            draftAnswer: 'Response Validation depends on Final Reporting.',
            knowledgePoints: [point],
            citations: [point.citation as KnowledgeCitation],
            usedScope: scopedWaterglass,
            graphContext: makeGraphContext(),
            reviewedAt: '2026-06-19T04:30:00.000Z',
        });

        expect(review.decision).toBe('revise');
        expect(review.failedGateIds).toContain('claim_dependency_consistency');
        expect(review.publicAnswer).toBe('Response Validation Dependencies: Response Validation depends on Baseline Measurement and Sensor Calibration.');
        expect(review.gates).toEqual(expect.arrayContaining([
            expect.objectContaining({
                gateId: 'claim_dependency_consistency',
                passed: false,
            }),
        ]));
    });

    test('revises grounded answers when Chinese dependency claims conflict with cited support', () => {
        const point = makeKnowledgePoint({
            title: '响应验证依赖项',
            summary: '响应验证依赖基线测量和传感器校准。',
            evidenceSnippet: '响应验证依赖基线测量和传感器校准。',
            citation: {
                ...(makeKnowledgePoint().citation as KnowledgeCitation),
                title: '响应验证依赖项',
                snippet: '响应验证依赖基线测量和传感器校准。',
            },
            citations: [
                {
                    ...(makeKnowledgePoint().citation as KnowledgeCitation),
                    title: '响应验证依赖项',
                    snippet: '响应验证依赖基线测量和传感器校准。',
                },
            ],
        });
        const review = reviewAnswerRelease({
            message: '响应验证依赖什么？',
            draftAnswer: '响应验证依赖最终报告。',
            knowledgePoints: [point],
            citations: [point.citation as KnowledgeCitation],
            usedScope: scopedWaterglass,
            graphContext: makeGraphContext(),
            reviewedAt: '2026-06-19T04:35:00.000Z',
        });

        expect(review.decision).toBe('revise');
        expect(review.failedGateIds).toContain('claim_dependency_consistency');
        expect(review.publicAnswer).toBe('响应验证依赖项: 响应验证依赖基线测量和传感器校准。');
        expect(review.gates).toEqual(expect.arrayContaining([
            expect.objectContaining({
                gateId: 'claim_dependency_consistency',
                passed: false,
            }),
        ]));
    });

    test('does not raise a dependency conflict when the draft keeps a supported prerequisite subset', () => {
        const point = makeKnowledgePoint({
            title: 'Response Validation Dependencies',
            summary: 'Response Validation depends on Baseline Measurement and Sensor Calibration.',
            evidenceSnippet: 'Response Validation depends on Baseline Measurement and Sensor Calibration.',
            citation: {
                ...(makeKnowledgePoint().citation as KnowledgeCitation),
                title: 'Response Validation Dependencies',
                snippet: 'Response Validation depends on Baseline Measurement and Sensor Calibration.',
            },
            citations: [
                {
                    ...(makeKnowledgePoint().citation as KnowledgeCitation),
                    title: 'Response Validation Dependencies',
                    snippet: 'Response Validation depends on Baseline Measurement and Sensor Calibration.',
                },
            ],
        });
        const review = reviewAnswerRelease({
            message: 'What is a prerequisite for response validation?',
            draftAnswer: 'Baseline Measurement is a prerequisite for Response Validation.',
            knowledgePoints: [point],
            citations: [point.citation as KnowledgeCitation],
            usedScope: scopedWaterglass,
            graphContext: makeGraphContext(),
            reviewedAt: '2026-06-19T04:40:00.000Z',
        });

        expect(review.decision).toBe('release');
        expect(review.failedGateIds).not.toContain('claim_dependency_consistency');
        expect(review.gates).toEqual(expect.arrayContaining([
            expect.objectContaining({
                gateId: 'claim_dependency_consistency',
                passed: true,
            }),
        ]));
    });

    test('revises grounded answers when same-subject state conflicts with cited support', () => {
        const point = makeKnowledgePoint({
            title: 'Water Glass Thermodynamics',
            summary: 'Water glass is an open system during the example setup.',
            evidenceSnippet: 'Water glass is an open system during the example setup.',
            citation: {
                ...(makeKnowledgePoint().citation as KnowledgeCitation),
                title: 'Water Glass Thermodynamics',
                snippet: 'Water glass is an open system during the example setup.',
            },
            citations: [
                {
                    ...(makeKnowledgePoint().citation as KnowledgeCitation),
                    title: 'Water Glass Thermodynamics',
                    snippet: 'Water glass is an open system during the example setup.',
                },
            ],
        });
        const review = reviewAnswerRelease({
            message: 'Is the example water glass open or closed?',
            draftAnswer: 'Water glass is a closed system during the example setup.',
            knowledgePoints: [point],
            citations: [point.citation as KnowledgeCitation],
            usedScope: scopedWaterglass,
            graphContext: makeGraphContext(),
            reviewedAt: '2026-06-19T00:40:00.000Z',
        });

        expect(review.decision).toBe('revise');
        expect(review.failedGateIds).toContain('claim_state_consistency');
        expect(review.publicAnswer).toBe('Water Glass Thermodynamics: Water glass is an open system during the example setup.');
        expect(review.gates).toEqual(expect.arrayContaining([
            expect.objectContaining({
                gateId: 'claim_state_consistency',
                passed: false,
            }),
        ]));
    });

    test('does not raise a state conflict when the draft is a compatible refinement', () => {
        const point = makeKnowledgePoint({
            title: 'Water Glass',
            summary: 'Water glass is a transparent container.',
            evidenceSnippet: 'Water glass is a transparent container.',
            citation: {
                ...(makeKnowledgePoint().citation as KnowledgeCitation),
                title: 'Water Glass',
                snippet: 'Water glass is a transparent container.',
            },
            citations: [
                {
                    ...(makeKnowledgePoint().citation as KnowledgeCitation),
                    title: 'Water Glass',
                    snippet: 'Water glass is a transparent container.',
                },
            ],
        });
        const review = reviewAnswerRelease({
            message: 'what is water glass',
            draftAnswer: 'Water glass is a transparent container filled with water.',
            knowledgePoints: [point],
            citations: [point.citation as KnowledgeCitation],
            usedScope: scopedWaterglass,
            graphContext: makeGraphContext(),
            reviewedAt: '2026-06-19T00:50:00.000Z',
        });

        expect(review.decision).toBe('release');
        expect(review.failedGateIds).not.toContain('claim_state_consistency');
        expect(review.gates).toEqual(expect.arrayContaining([
            expect.objectContaining({
                gateId: 'claim_state_consistency',
                passed: true,
            }),
        ]));
    });

    test('revises grounded answers when draft polarity conflicts with cited support', () => {
        const review = reviewAnswerRelease({
            message: 'what is water glass',
            draftAnswer: 'Water glass is not a transparent container filled with water.',
            knowledgePoints: [makeKnowledgePoint()],
            citations: [makeKnowledgePoint().citation as KnowledgeCitation],
            usedScope: scopedWaterglass,
            graphContext: makeGraphContext(),
            reviewedAt: '2026-06-19T01:00:00.000Z',
        });

        expect(review.decision).toBe('revise');
        expect(review.failedGateIds).toContain('claim_polarity_consistency');
        expect(review.publicAnswer).toBe('Water glass is a transparent container filled with water.');
        expect(review.gates).toEqual(expect.arrayContaining([
            expect.objectContaining({
                gateId: 'claim_polarity_consistency',
                passed: false,
            }),
        ]));
    });

    test('does not raise a polarity conflict when support includes an unrelated negative sentence', () => {
        const point = makeKnowledgePoint({
            summary: 'Water glass is not plastic. Water glass is a transparent container filled with water.',
            evidenceSnippet: 'Water glass is not plastic. Water glass is a transparent container filled with water.',
            citation: {
                ...(makeKnowledgePoint().citation as KnowledgeCitation),
                snippet: 'Water glass is not plastic. Water glass is a transparent container filled with water.',
            },
            citations: [
                {
                    ...(makeKnowledgePoint().citation as KnowledgeCitation),
                    snippet: 'Water glass is not plastic. Water glass is a transparent container filled with water.',
                },
            ],
        });
        const review = reviewAnswerRelease({
            message: 'what is water glass',
            draftAnswer: 'Water glass is a transparent container filled with water.',
            knowledgePoints: [point],
            citations: [point.citation as KnowledgeCitation],
            usedScope: scopedWaterglass,
            graphContext: makeGraphContext(),
            reviewedAt: '2026-06-19T01:10:00.000Z',
        });

        expect(review.decision).toBe('release');
        expect(review.failedGateIds).not.toContain('claim_polarity_consistency');
        expect(review.gates).toEqual(expect.arrayContaining([
            expect.objectContaining({
                gateId: 'claim_polarity_consistency',
                passed: true,
            }),
        ]));
    });

    test('revises grounded answers when Chinese polarity conflicts with cited support', () => {
        const point = makeKnowledgePoint({
            title: '水杯',
            summary: '水杯是透明的盛水容器。',
            evidenceSnippet: '水杯是透明的盛水容器。',
            citation: {
                ...(makeKnowledgePoint().citation as KnowledgeCitation),
                title: '水杯',
                snippet: '水杯是透明的盛水容器。',
            },
            citations: [
                {
                    ...(makeKnowledgePoint().citation as KnowledgeCitation),
                    title: '水杯',
                    snippet: '水杯是透明的盛水容器。',
                },
            ],
        });
        const review = reviewAnswerRelease({
            message: '什么是水杯',
            draftAnswer: '水杯不是透明的盛水容器。',
            knowledgePoints: [point],
            citations: [point.citation as KnowledgeCitation],
            usedScope: scopedWaterglass,
            graphContext: makeGraphContext(),
            reviewedAt: '2026-06-19T01:20:00.000Z',
        });

        expect(review.decision).toBe('revise');
        expect(review.failedGateIds).toContain('claim_polarity_consistency');
        expect(review.publicAnswer).toBe('水杯是透明的盛水容器。');
    });

    test('revises grounded answers when Chinese same-subject state conflicts with cited support', () => {
        const point = makeKnowledgePoint({
            title: '水杯热力学',
            summary: '水杯是开放系统。',
            evidenceSnippet: '水杯是开放系统。',
            citation: {
                ...(makeKnowledgePoint().citation as KnowledgeCitation),
                title: '水杯热力学',
                snippet: '水杯是开放系统。',
            },
            citations: [
                {
                    ...(makeKnowledgePoint().citation as KnowledgeCitation),
                    title: '水杯热力学',
                    snippet: '水杯是开放系统。',
                },
            ],
        });
        const review = reviewAnswerRelease({
            message: '水杯是开放系统还是封闭系统？',
            draftAnswer: '水杯是封闭系统。',
            knowledgePoints: [point],
            citations: [point.citation as KnowledgeCitation],
            usedScope: scopedWaterglass,
            graphContext: makeGraphContext(),
            reviewedAt: '2026-06-19T01:25:00.000Z',
        });

        expect(review.decision).toBe('revise');
        expect(review.failedGateIds).toContain('claim_state_consistency');
        expect(review.publicAnswer).toBe('水杯热力学: 水杯是开放系统。');
    });

    test('revises grounded answers when prerequisite order is reversed against the DAG', () => {
        const point = makeKnowledgePoint({
            atomId: 'atom_ground_state',
            atomIds: ['atom_ground_state'],
            title: 'Ground State',
            summary: 'Ground State is stabilized after Bridge Layer is established.',
            evidenceSnippet: 'Ground State is stabilized after Bridge Layer is established.',
            citation: {
                ...(makeKnowledgePoint().citation as KnowledgeCitation),
                atomId: 'atom_ground_state',
                title: 'Ground State',
                snippet: 'Ground State is stabilized after Bridge Layer is established.',
            },
            citations: [
                {
                    ...(makeKnowledgePoint().citation as KnowledgeCitation),
                    atomId: 'atom_ground_state',
                    title: 'Ground State',
                    snippet: 'Ground State is stabilized after Bridge Layer is established.',
                },
            ],
        });
        const review = reviewAnswerRelease({
            message: 'How are Bridge Layer and Ground State ordered?',
            draftAnswer: 'Ground State is a prerequisite for Bridge Layer.',
            knowledgePoints: [point],
            citations: [point.citation as KnowledgeCitation],
            usedScope: scopedWaterglass,
            graphContext: makeOrderedGraphContext(),
            reviewedAt: '2026-06-19T02:05:00.000Z',
        });

        expect(review.decision).toBe('revise');
        expect(review.failedGateIds).toContain('claim_graph_order_consistency');
        expect(review.publicAnswer).toBe('Bridge Layer is a prerequisite for Ground State.');
        expect(review.gates).toEqual(expect.arrayContaining([
            expect.objectContaining({
                gateId: 'claim_graph_order_consistency',
                passed: false,
            }),
        ]));
    });

    test('keeps grounded answers when prerequisite order matches the DAG', () => {
        const point = makeKnowledgePoint({
            atomId: 'atom_ground_state',
            atomIds: ['atom_ground_state'],
            title: 'Ground State',
            summary: 'Ground State is stabilized after Bridge Layer is established.',
            evidenceSnippet: 'Ground State is stabilized after Bridge Layer is established.',
            citation: {
                ...(makeKnowledgePoint().citation as KnowledgeCitation),
                atomId: 'atom_ground_state',
                title: 'Ground State',
                snippet: 'Ground State is stabilized after Bridge Layer is established.',
            },
            citations: [
                {
                    ...(makeKnowledgePoint().citation as KnowledgeCitation),
                    atomId: 'atom_ground_state',
                    title: 'Ground State',
                    snippet: 'Ground State is stabilized after Bridge Layer is established.',
                },
            ],
        });
        const review = reviewAnswerRelease({
            message: 'How are Bridge Layer and Ground State ordered?',
            draftAnswer: 'Bridge Layer is a prerequisite for Ground State.',
            knowledgePoints: [point],
            citations: [point.citation as KnowledgeCitation],
            usedScope: scopedWaterglass,
            graphContext: makeOrderedGraphContext(),
            reviewedAt: '2026-06-19T02:10:00.000Z',
        });

        expect(review.decision).toBe('release');
        expect(review.failedGateIds).not.toContain('claim_graph_order_consistency');
        expect(review.publicAnswer).toBe('Bridge Layer is a prerequisite for Ground State.');
        expect(review.gates).toEqual(expect.arrayContaining([
            expect.objectContaining({
                gateId: 'claim_graph_order_consistency',
                passed: true,
            }),
        ]));
    });

    test('revises grounded answers when sequence order is reversed against the DAG', () => {
        const point = makeKnowledgePoint({
            atomId: 'atom_response_validation',
            atomIds: ['atom_response_validation'],
            title: 'Response Validation',
            summary: 'Response Validation runs after Baseline Measurement.',
            evidenceSnippet: 'Response Validation runs after Baseline Measurement.',
            citation: {
                ...(makeKnowledgePoint().citation as KnowledgeCitation),
                atomId: 'atom_response_validation',
                title: 'Response Validation',
                snippet: 'Response Validation runs after Baseline Measurement.',
            },
            citations: [
                {
                    ...(makeKnowledgePoint().citation as KnowledgeCitation),
                    atomId: 'atom_response_validation',
                    title: 'Response Validation',
                    snippet: 'Response Validation runs after Baseline Measurement.',
                },
            ],
        });
        const review = reviewAnswerRelease({
            message: 'Which step comes first?',
            draftAnswer: 'Response Validation comes before Baseline Measurement.',
            knowledgePoints: [point],
            citations: [point.citation as KnowledgeCitation],
            usedScope: scopedWaterglass,
            graphContext: makeOrderedGraphContext({
                anchorAtomId: 'atom_response_validation',
                anchorTitle: 'Response Validation',
                supportingAtomIds: ['atom_baseline_measurement'],
                supportingTitles: ['Baseline Measurement'],
                relationKinds: ['sequence'],
                relationSummaries: [
                    {
                        relationKind: 'sequence',
                        edgeIds: ['edge_baseline_to_validation'],
                        sourceAtomIds: ['atom_baseline_measurement'],
                        targetAtomIds: ['atom_response_validation'],
                        averageConfidence: 0.91,
                    },
                ],
                connectionPaths: [
                    {
                        sourceAtomId: 'atom_baseline_measurement',
                        sourceTitle: 'Baseline Measurement',
                        targetAtomId: 'atom_response_validation',
                        targetTitle: 'Response Validation',
                        pathAtomIds: ['atom_baseline_measurement', 'atom_response_validation'],
                        pathTitles: ['Baseline Measurement', 'Response Validation'],
                        pathEdges: [
                            {
                                fromAtomId: 'atom_baseline_measurement',
                                toAtomId: 'atom_response_validation',
                                relationKind: 'sequence',
                            },
                        ],
                        length: 1,
                    },
                ],
                predecessorWindow: [
                    {
                        atomId: 'atom_baseline_measurement',
                        title: 'Baseline Measurement',
                        relationKind: 'sequence',
                        confidence: 0.91,
                    },
                ],
            }),
            reviewedAt: '2026-06-19T02:20:00.000Z',
        });

        expect(review.decision).toBe('revise');
        expect(review.failedGateIds).toContain('claim_graph_order_consistency');
        expect(review.publicAnswer).toBe('Baseline Measurement comes before Response Validation.');
    });

    test('revises grounded answers when causal direction is reversed against the DAG', () => {
        const point = makeKnowledgePoint({
            atomId: 'atom_pressure_rise',
            atomIds: ['atom_pressure_rise'],
            title: 'Pressure Rise',
            summary: 'Pressure Rise follows thermal expansion in the sealed example.',
            evidenceSnippet: 'Pressure Rise follows thermal expansion in the sealed example.',
            citation: {
                ...(makeKnowledgePoint().citation as KnowledgeCitation),
                atomId: 'atom_pressure_rise',
                title: 'Pressure Rise',
                snippet: 'Pressure Rise follows thermal expansion in the sealed example.',
            },
            citations: [
                {
                    ...(makeKnowledgePoint().citation as KnowledgeCitation),
                    atomId: 'atom_pressure_rise',
                    title: 'Pressure Rise',
                    snippet: 'Pressure Rise follows thermal expansion in the sealed example.',
                },
            ],
        });
        const review = reviewAnswerRelease({
            message: 'What causes the pressure rise?',
            draftAnswer: 'Pressure Rise causes Thermal Expansion.',
            knowledgePoints: [point],
            citations: [point.citation as KnowledgeCitation],
            usedScope: scopedWaterglass,
            graphContext: makeOrderedGraphContext({
                anchorAtomId: 'atom_pressure_rise',
                anchorTitle: 'Pressure Rise',
                supportingAtomIds: ['atom_thermal_expansion'],
                supportingTitles: ['Thermal Expansion'],
                relationKinds: ['causal'],
                relationSummaries: [
                    {
                        relationKind: 'causal',
                        edgeIds: ['edge_expansion_to_pressure'],
                        sourceAtomIds: ['atom_thermal_expansion'],
                        targetAtomIds: ['atom_pressure_rise'],
                        averageConfidence: 0.94,
                    },
                ],
                connectionPaths: [
                    {
                        sourceAtomId: 'atom_thermal_expansion',
                        sourceTitle: 'Thermal Expansion',
                        targetAtomId: 'atom_pressure_rise',
                        targetTitle: 'Pressure Rise',
                        pathAtomIds: ['atom_thermal_expansion', 'atom_pressure_rise'],
                        pathTitles: ['Thermal Expansion', 'Pressure Rise'],
                        pathEdges: [
                            {
                                fromAtomId: 'atom_thermal_expansion',
                                toAtomId: 'atom_pressure_rise',
                                relationKind: 'causal',
                            },
                        ],
                        length: 1,
                    },
                ],
                predecessorWindow: [
                    {
                        atomId: 'atom_thermal_expansion',
                        title: 'Thermal Expansion',
                        relationKind: 'causal',
                        confidence: 0.94,
                    },
                ],
            }),
            reviewedAt: '2026-06-19T04:00:00.000Z',
        });

        expect(review.decision).toBe('revise');
        expect(review.failedGateIds).toContain('claim_graph_causal_consistency');
        expect(review.publicAnswer).toBe('Thermal Expansion causes Pressure Rise.');
        expect(review.gates).toEqual(expect.arrayContaining([
            expect.objectContaining({
                gateId: 'claim_graph_causal_consistency',
                passed: false,
            }),
        ]));
    });

    test('keeps grounded answers when causal direction matches the DAG', () => {
        const point = makeKnowledgePoint({
            atomId: 'atom_pressure_rise',
            atomIds: ['atom_pressure_rise'],
            title: 'Pressure Rise',
            summary: 'Pressure Rise follows thermal expansion in the sealed example.',
            evidenceSnippet: 'Pressure Rise follows thermal expansion in the sealed example.',
            citation: {
                ...(makeKnowledgePoint().citation as KnowledgeCitation),
                atomId: 'atom_pressure_rise',
                title: 'Pressure Rise',
                snippet: 'Pressure Rise follows thermal expansion in the sealed example.',
            },
            citations: [
                {
                    ...(makeKnowledgePoint().citation as KnowledgeCitation),
                    atomId: 'atom_pressure_rise',
                    title: 'Pressure Rise',
                    snippet: 'Pressure Rise follows thermal expansion in the sealed example.',
                },
            ],
        });
        const review = reviewAnswerRelease({
            message: 'What causes the pressure rise?',
            draftAnswer: 'Thermal Expansion causes Pressure Rise.',
            knowledgePoints: [point],
            citations: [point.citation as KnowledgeCitation],
            usedScope: scopedWaterglass,
            graphContext: makeOrderedGraphContext({
                anchorAtomId: 'atom_pressure_rise',
                anchorTitle: 'Pressure Rise',
                supportingAtomIds: ['atom_thermal_expansion'],
                supportingTitles: ['Thermal Expansion'],
                relationKinds: ['causal'],
                relationSummaries: [
                    {
                        relationKind: 'causal',
                        edgeIds: ['edge_expansion_to_pressure'],
                        sourceAtomIds: ['atom_thermal_expansion'],
                        targetAtomIds: ['atom_pressure_rise'],
                        averageConfidence: 0.94,
                    },
                ],
                connectionPaths: [
                    {
                        sourceAtomId: 'atom_thermal_expansion',
                        sourceTitle: 'Thermal Expansion',
                        targetAtomId: 'atom_pressure_rise',
                        targetTitle: 'Pressure Rise',
                        pathAtomIds: ['atom_thermal_expansion', 'atom_pressure_rise'],
                        pathTitles: ['Thermal Expansion', 'Pressure Rise'],
                        pathEdges: [
                            {
                                fromAtomId: 'atom_thermal_expansion',
                                toAtomId: 'atom_pressure_rise',
                                relationKind: 'causal',
                            },
                        ],
                        length: 1,
                    },
                ],
                predecessorWindow: [
                    {
                        atomId: 'atom_thermal_expansion',
                        title: 'Thermal Expansion',
                        relationKind: 'causal',
                        confidence: 0.94,
                    },
                ],
            }),
            reviewedAt: '2026-06-19T04:05:00.000Z',
        });

        expect(review.decision).toBe('release');
        expect(review.failedGateIds).not.toContain('claim_graph_causal_consistency');
        expect(review.publicAnswer).toBe('Thermal Expansion causes Pressure Rise.');
        expect(review.gates).toEqual(expect.arrayContaining([
            expect.objectContaining({
                gateId: 'claim_graph_causal_consistency',
                passed: true,
            }),
        ]));
    });

    test('revises grounded answers when Chinese causal direction is reversed against the DAG', () => {
        const point = makeKnowledgePoint({
            atomId: 'atom_pressure_rise_zh',
            atomIds: ['atom_pressure_rise_zh'],
            title: '压力升高',
            summary: '密闭示例中，热膨胀会导致压力升高。',
            evidenceSnippet: '密闭示例中，热膨胀会导致压力升高。',
            citation: {
                ...(makeKnowledgePoint().citation as KnowledgeCitation),
                atomId: 'atom_pressure_rise_zh',
                title: '压力升高',
                snippet: '密闭示例中，热膨胀会导致压力升高。',
            },
            citations: [
                {
                    ...(makeKnowledgePoint().citation as KnowledgeCitation),
                    atomId: 'atom_pressure_rise_zh',
                    title: '压力升高',
                    snippet: '密闭示例中，热膨胀会导致压力升高。',
                },
            ],
        });
        const review = reviewAnswerRelease({
            message: '是什么导致压力升高？',
            draftAnswer: '压力升高导致热膨胀。',
            knowledgePoints: [point],
            citations: [point.citation as KnowledgeCitation],
            usedScope: scopedWaterglass,
            graphContext: makeOrderedGraphContext({
                anchorAtomId: 'atom_pressure_rise_zh',
                anchorTitle: '压力升高',
                supportingAtomIds: ['atom_thermal_expansion_zh'],
                supportingTitles: ['热膨胀'],
                relationKinds: ['causal'],
                relationSummaries: [
                    {
                        relationKind: 'causal',
                        edgeIds: ['edge_expansion_to_pressure_zh'],
                        sourceAtomIds: ['atom_thermal_expansion_zh'],
                        targetAtomIds: ['atom_pressure_rise_zh'],
                        averageConfidence: 0.94,
                    },
                ],
                connectionPaths: [
                    {
                        sourceAtomId: 'atom_thermal_expansion_zh',
                        sourceTitle: '热膨胀',
                        targetAtomId: 'atom_pressure_rise_zh',
                        targetTitle: '压力升高',
                        pathAtomIds: ['atom_thermal_expansion_zh', 'atom_pressure_rise_zh'],
                        pathTitles: ['热膨胀', '压力升高'],
                        pathEdges: [
                            {
                                fromAtomId: 'atom_thermal_expansion_zh',
                                toAtomId: 'atom_pressure_rise_zh',
                                relationKind: 'causal',
                            },
                        ],
                        length: 1,
                    },
                ],
                predecessorWindow: [
                    {
                        atomId: 'atom_thermal_expansion_zh',
                        title: '热膨胀',
                        relationKind: 'causal',
                        confidence: 0.94,
                    },
                ],
            }),
            reviewedAt: '2026-06-19T04:10:00.000Z',
        });

        expect(review.decision).toBe('revise');
        expect(review.failedGateIds).toContain('claim_graph_causal_consistency');
        expect(review.publicAnswer).toBe('热膨胀导致压力升高。');
    });

    test('revises grounded answers when a DAG contrast pair is incorrectly released as an analogy claim', () => {
        const point = makeKnowledgePoint({
            title: 'Plastic Cup',
            summary: 'Plastic Cup contrasts with Metal Cup in the current comparison context.',
            evidenceSnippet: 'Plastic Cup contrasts with Metal Cup in the current comparison context.',
            citation: {
                ...(makeKnowledgePoint().citation as KnowledgeCitation),
                title: 'Plastic Cup',
                snippet: 'Plastic Cup contrasts with Metal Cup in the current comparison context.',
            },
            citations: [
                {
                    ...(makeKnowledgePoint().citation as KnowledgeCitation),
                    title: 'Plastic Cup',
                    snippet: 'Plastic Cup contrasts with Metal Cup in the current comparison context.',
                },
            ],
        });
        const review = reviewAnswerRelease({
            message: 'compare plastic cup and metal cup',
            draftAnswer: 'Plastic Cup is similar to Metal Cup.',
            knowledgePoints: [point],
            citations: [point.citation as KnowledgeCitation],
            usedScope: scopedWaterglass,
            graphContext: makeComparisonGraphContext('contrast', 'Plastic Cup', 'Metal Cup'),
            reviewedAt: '2026-06-19T03:45:00.000Z',
        });

        expect(review.decision).toBe('revise');
        expect(review.failedGateIds).toContain('claim_graph_comparison_consistency');
        expect(review.publicAnswer).toBe('Plastic Cup contrasts with Metal Cup.');
        expect(review.gates).toEqual(expect.arrayContaining([
            expect.objectContaining({
                gateId: 'claim_graph_comparison_consistency',
                passed: false,
            }),
        ]));
    });

    test('keeps grounded answers when the DAG contrast claim already matches the public answer', () => {
        const point = makeKnowledgePoint({
            title: 'Plastic Cup',
            summary: 'Plastic Cup contrasts with Metal Cup in the current comparison context.',
            evidenceSnippet: 'Plastic Cup contrasts with Metal Cup in the current comparison context.',
            citation: {
                ...(makeKnowledgePoint().citation as KnowledgeCitation),
                title: 'Plastic Cup',
                snippet: 'Plastic Cup contrasts with Metal Cup in the current comparison context.',
            },
            citations: [
                {
                    ...(makeKnowledgePoint().citation as KnowledgeCitation),
                    title: 'Plastic Cup',
                    snippet: 'Plastic Cup contrasts with Metal Cup in the current comparison context.',
                },
            ],
        });
        const review = reviewAnswerRelease({
            message: 'compare plastic cup and metal cup',
            draftAnswer: 'Plastic Cup contrasts with Metal Cup.',
            knowledgePoints: [point],
            citations: [point.citation as KnowledgeCitation],
            usedScope: scopedWaterglass,
            graphContext: makeComparisonGraphContext('contrast', 'Plastic Cup', 'Metal Cup'),
            reviewedAt: '2026-06-19T03:50:00.000Z',
        });

        expect(review.decision).toBe('release');
        expect(review.failedGateIds).not.toContain('claim_graph_comparison_consistency');
        expect(review.publicAnswer).toBe('Plastic Cup contrasts with Metal Cup.');
        expect(review.gates).toEqual(expect.arrayContaining([
            expect.objectContaining({
                gateId: 'claim_graph_comparison_consistency',
                passed: true,
            }),
        ]));
    });

    test('revises grounded answers when a DAG analogy pair is incorrectly released as a Chinese contrast claim', () => {
        const point = makeKnowledgePoint({
            title: '层流',
            summary: '层流与电路电流类似。',
            evidenceSnippet: '层流与电路电流类似。',
            citation: {
                ...(makeKnowledgePoint().citation as KnowledgeCitation),
                title: '层流',
                snippet: '层流与电路电流类似。',
            },
            citations: [
                {
                    ...(makeKnowledgePoint().citation as KnowledgeCitation),
                    title: '层流',
                    snippet: '层流与电路电流类似。',
                },
            ],
        });
        const review = reviewAnswerRelease({
            message: '对比层流和电路电流',
            draftAnswer: '层流与电路电流不同。',
            knowledgePoints: [point],
            citations: [point.citation as KnowledgeCitation],
            usedScope: scopedWaterglass,
            graphContext: makeComparisonGraphContext('analogy', '层流', '电路电流'),
            reviewedAt: '2026-06-19T03:55:00.000Z',
        });

        expect(review.decision).toBe('revise');
        expect(review.failedGateIds).toContain('claim_graph_comparison_consistency');
        expect(review.publicAnswer).toBe('层流与电路电流类似。');
    });
});

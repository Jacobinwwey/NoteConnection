import {
    buildScopedConversationReply,
    collectAgentConversationAtomIds,
    mergeAgentConversationKnowledgePoints,
} from './conversationComposer';
import type {
    AgentConversationGraphContext,
    AgentConversationKnowledgePoint,
    AgentConversationMemoryAction,
    AgentConversationMemoryRecord,
    EvidenceSpan,
    KnowledgeAtom,
    KnowledgeQueryItem,
    KnowledgeQueryResolvedScope,
    RagContextPack,
    RagSufficiencyReview,
    RelationEdge,
} from './types';

function makeAtom(overrides: Partial<KnowledgeAtom> = {}): KnowledgeAtom {
    return {
        id: overrides.id || 'atom_1',
        stableKey: overrides.stableKey || 'atom_1',
        documentId: overrides.documentId || 'doc_1',
        sourcePath: overrides.sourcePath || 'Knowledge_Base/test/doc.md',
        title: overrides.title || 'Water Glass',
        content: overrides.content || 'A water glass is a transparent drinking vessel that contains water for use.',
        representationType: overrides.representationType || 'text',
        keywords: overrides.keywords || ['water', 'glass'],
        evidenceSpanIds: overrides.evidenceSpanIds || ['evidence_1'],
        createdAt: overrides.createdAt || '2026-06-06T00:00:00.000Z',
        updatedAt: overrides.updatedAt || '2026-06-06T00:00:00.000Z',
        metadata: overrides.metadata || {
            sectionPath: ['Water Glass'],
            version: 1,
            sourceHash: 'hash',
            language: 'en',
        },
    };
}

function makeEvidenceSpan(overrides: Partial<EvidenceSpan> = {}): EvidenceSpan {
    return {
        id: overrides.id || 'evidence_1',
        documentId: overrides.documentId || 'doc_1',
        sourcePath: overrides.sourcePath || 'Knowledge_Base/test/doc.md',
        language: overrides.language || 'en',
        startOffset: overrides.startOffset || 0,
        endOffset: overrides.endOffset || 42,
        startLine: overrides.startLine || 3,
        endLine: overrides.endLine || 4,
        snippet: overrides.snippet || 'A water glass is a transparent drinking vessel that contains water for use.',
        sourceHash: overrides.sourceHash || 'hash',
        createdAt: overrides.createdAt || '2026-06-06T00:00:00.000Z',
    };
}

function makeQueryItem(overrides: {
    atom?: Partial<KnowledgeAtom>;
    evidence?: Partial<EvidenceSpan>;
    score?: number;
    relationPath?: Partial<RelationEdge>[];
    temporalValidity?: Partial<KnowledgeQueryItem['temporalValidity']>;
} = {}): KnowledgeQueryItem {
    const atom = makeAtom(overrides.atom);
    const evidence = makeEvidenceSpan({
        documentId: atom.documentId,
        sourcePath: atom.sourcePath,
        ...overrides.evidence,
    });
    return {
        atom,
        score: overrides.score == null ? 0.91 : overrides.score,
        evidenceSpans: [evidence],
        relationPath: Array.isArray(overrides.relationPath)
            ? overrides.relationPath.map((edge, index) => ({
                id: String(edge && edge.id || `edge_${atom.id}_${index + 1}`),
                sourceAtomId: String(edge && edge.sourceAtomId || atom.id),
                targetAtomId: String(edge && edge.targetAtomId || `support_${index + 1}`),
                relationKind: (edge && edge.relationKind) || 'reference',
                provenance: (edge && edge.provenance) || 'fact',
                confidence: Number.isFinite(Number(edge && edge.confidence)) ? Number(edge && edge.confidence) : 0.8,
                evidenceSpanIds: Array.isArray(edge?.evidenceSpanIds) ? edge.evidenceSpanIds.slice() : [evidence.id],
                temporal: {
                    validFrom: String(edge && edge.temporal && edge.temporal.validFrom || '2026-06-06T00:00:00.000Z'),
                    validTo: edge && edge.temporal && edge.temporal.validTo ? String(edge.temporal.validTo) : undefined,
                },
            }))
            : [],
        temporalValidity: {
            isValid: overrides.temporalValidity && typeof overrides.temporalValidity.isValid === 'boolean'
                ? overrides.temporalValidity.isValid
                : true,
            checkedAt: String(overrides.temporalValidity && overrides.temporalValidity.checkedAt || '2026-06-06T00:00:00.000Z'),
            reasons: Array.isArray(overrides.temporalValidity?.reasons)
                ? overrides.temporalValidity.reasons.slice()
                : [],
            details: Array.isArray((overrides.temporalValidity as any)?.details)
                ? (overrides.temporalValidity as any).details.map((detail: any) => ({
                    edgeId: String(detail && detail.edgeId || ''),
                    edgeKind: detail && detail.edgeKind,
                    sourceAtomId: String(detail && detail.sourceAtomId || ''),
                    targetAtomId: String(detail && detail.targetAtomId || ''),
                    validFrom: String(detail && detail.validFrom || '2026-06-06T00:00:00.000Z'),
                    validTo: detail && detail.validTo ? String(detail.validTo) : undefined,
                    isActive: detail && detail.isActive !== false,
                }))
                : [],
        },
    };
}

const globalScope: KnowledgeQueryResolvedScope = {
    source: 'global',
    workspaceId: null,
    corpusId: null,
    documentIds: [],
    atomIds: [],
    sourcePathPrefixes: [],
    languages: [],
    matchedAtomCount: 0,
};

describe('conversationComposer', () => {
    test('merges query items by document and preserves grouped spans/citations', () => {
        const items: KnowledgeQueryItem[] = [
            makeQueryItem({
                atom: {
                    id: 'atom_a',
                    documentId: 'doc_grouped',
                    title: 'Water Glass',
                    content: 'A water glass is a transparent vessel.',
                },
                evidence: {
                    id: 'evidence_a',
                    startLine: 2,
                    endLine: 2,
                    snippet: 'A water glass is a transparent vessel.',
                },
                score: 0.9,
                relationPath: [
                    {
                        id: 'edge_grouped_1',
                        sourceAtomId: 'atom_a',
                        targetAtomId: 'atom_support_1',
                        relationKind: 'prerequisite',
                    },
                ],
            }),
            makeQueryItem({
                atom: {
                    id: 'atom_b',
                    documentId: 'doc_grouped',
                    title: 'Material Boundary',
                    content: 'The water glass body provides a boundary between the liquid and the environment.',
                },
                evidence: {
                    id: 'evidence_b',
                    startLine: 6,
                    endLine: 6,
                    snippet: 'The water glass body provides a boundary between the liquid and the environment.',
                },
                score: 0.82,
                relationPath: [
                    {
                        id: 'edge_grouped_2',
                        sourceAtomId: 'atom_b',
                        targetAtomId: 'atom_support_2',
                        relationKind: 'contrast',
                    },
                ],
                temporalValidity: {
                    isValid: false,
                    checkedAt: '2026-06-06T02:00:00.000Z',
                    reasons: ['temporal_edge_expired'],
                },
            }),
        ];

        const points = mergeAgentConversationKnowledgePoints(items, (atomId) => [{ actionId: `focus_${atomId}` }]);
        expect(points).toHaveLength(1);
        expect(points[0].documentId).toBe('doc_grouped');
        expect(points[0].atomIds).toEqual(expect.arrayContaining(['atom_a', 'atom_b']));
        expect(points[0].citations?.length).toBe(2);
        expect(points[0].matchedSpans?.length).toBe(2);
        expect(points[0].matchedSpans?.[0]).toEqual(expect.objectContaining({
            startOffset: 0,
            endOffset: 42,
        }));
        expect(points[0].citations?.[0]).toEqual(expect.objectContaining({
            startOffset: 0,
            endOffset: 42,
        }));
        expect(points[0].matchCount).toBe(2);
        expect((points[0] as any).relationPath).toHaveLength(2);
        expect((points[0] as any).relationKinds).toEqual(expect.arrayContaining(['prerequisite', 'contrast']));
        expect((points[0] as any).relationPathAtomIds).toEqual(expect.arrayContaining(['atom_support_1', 'atom_support_2']));
        expect((points[0] as any).temporalValidity).toEqual(expect.objectContaining({
            isValid: false,
            checkedAt: '2026-06-06T02:00:00.000Z',
        }));
    });

    test('builds intent-aware scoped reply blocks and preserves additive compatibility shape', () => {
        const knowledgePoints = [
            {
                atomId: 'atom_a',
                atomIds: ['atom_a', 'atom_b'],
                documentId: 'doc_grouped',
                sourcePath: 'Knowledge_Base/test/doc.md',
                title: 'Reflection',
                summary: 'Reflection and absorption differ in how optical energy is redirected versus dissipated.',
                evidenceSnippet: 'Reflection and absorption differ in how optical energy is redirected versus dissipated.',
                score: 0.93,
                citation: {
                    citationId: 'citation_a',
                    atomId: 'atom_a',
                    documentId: 'doc_grouped',
                    sourcePath: 'Knowledge_Base/test/doc.md',
                    title: 'Reflection',
                    snippet: 'Reflection and absorption differ in how optical energy is redirected versus dissipated.',
                    startLine: 4,
                    endLine: 4,
                    score: 0.93,
                },
                citations: [
                    {
                        citationId: 'citation_a',
                        atomId: 'atom_a',
                        documentId: 'doc_grouped',
                        sourcePath: 'Knowledge_Base/test/doc.md',
                        title: 'Reflection',
                        snippet: 'Reflection and absorption differ in how optical energy is redirected versus dissipated.',
                        startLine: 4,
                        endLine: 4,
                        score: 0.93,
                    },
                ],
                matchedSpans: [
                    {
                        atomId: 'atom_a',
                        title: 'Reflection',
                        snippet: 'Reflection and absorption differ in how optical energy is redirected versus dissipated.',
                        sourcePath: 'Knowledge_Base/test/doc.md',
                        startLine: 4,
                        endLine: 4,
                        score: 0.93,
                        citation: {
                            citationId: 'citation_a',
                            atomId: 'atom_a',
                            documentId: 'doc_grouped',
                            sourcePath: 'Knowledge_Base/test/doc.md',
                            title: 'Reflection',
                            snippet: 'Reflection and absorption differ in how optical energy is redirected versus dissipated.',
                            startLine: 4,
                            endLine: 4,
                            score: 0.93,
                        },
                    },
                ],
                matchCount: 1,
                relationPath: [
                    {
                        edgeId: 'edge_reflection_1',
                        sourceAtomId: 'atom_a',
                        targetAtomId: 'atom_prerequisite',
                        relationKind: 'prerequisite',
                        confidence: 0.9,
                    },
                    {
                        edgeId: 'edge_reflection_2',
                        sourceAtomId: 'atom_a',
                        targetAtomId: 'atom_contrast',
                        relationKind: 'contrast',
                        confidence: 0.82,
                    },
                ],
                relationPathAtomIds: ['atom_prerequisite', 'atom_contrast'],
                relationKinds: ['prerequisite', 'contrast'],
                temporalValidity: {
                    isValid: false,
                    checkedAt: '2026-06-06T06:00:00.000Z',
                    reasons: ['temporal_edge_expired'],
                },
                capabilities: [{ actionId: 'open_focus_mode' }],
            },
        ] as AgentConversationKnowledgePoint[];
        const citations = knowledgePoints[0].citations || [];
        const recalledMemories: AgentConversationMemoryRecord[] = [];
        const memoryActions: AgentConversationMemoryAction[] = [
            {
                kind: 'persist_session_memory',
                status: 'applied',
                layer: 'session',
                namespace: 'conversation',
                reason: 'Persist the latest user focus to scoped conversation memory.',
            },
        ];
        let blockCounter = 0;
        const reply = buildScopedConversationReply({
            message: 'compare reflection vs absorption',
            knowledgePoints,
            citations,
            recalledMemories,
            memoryActions,
            usedScope: globalScope,
            nextBlockId: () => `assistant_block_${++blockCounter}`,
        });

        expect(reply.answer).toBe(
            'The retrieved evidence for Reflection carries temporal warnings, so I cannot safely present it as the current answer.'
        );
        expect(reply.answer).not.toContain('Grounded by');
        expect(reply.answer).not.toContain('Key evidence');
        expect(reply.assistantBlocks.map((block) => block.type)).toEqual(
            expect.arrayContaining(['structured_answer', 'system_notice', 'citations', 'knowledge_actions', 'knowledge_run_summary'])
        );
        const structuredBlock = reply.assistantBlocks.find((block) => block.type === 'structured_answer');
        expect(reply.graphContext).not.toBeNull();
        const graphContext = reply.graphContext as NonNullable<typeof reply.graphContext>;
        expect(graphContext).toEqual(expect.objectContaining({
            anchorAtomId: 'atom_a',
            anchorTitle: 'Reflection',
            relationKinds: expect.arrayContaining(['prerequisite', 'contrast']),
            supportingAtomIds: expect.arrayContaining(['atom_prerequisite', 'atom_contrast']),
            temporalValidity: expect.objectContaining({
                allPointsValid: false,
                warningReasons: ['temporal_edge_expired'],
                invalidKnowledgePointTitles: ['Reflection'],
            }),
        }));
        expect(graphContext.relationSummaries).toEqual(expect.arrayContaining([
            expect.objectContaining({
                relationKind: 'prerequisite',
                targetAtomIds: ['atom_prerequisite'],
            }),
            expect.objectContaining({
                relationKind: 'contrast',
                targetAtomIds: ['atom_contrast'],
            }),
        ]));
        expect(structuredBlock && 'directAnswer' in structuredBlock ? structuredBlock.directAnswer : '').toBe(
            'The retrieved evidence for Reflection carries temporal warnings, so I cannot safely present it as the current answer.'
        );
        expect(structuredBlock && 'directAnswer' in structuredBlock ? structuredBlock.directAnswer : '').not.toContain('Grounded by');
        expect(structuredBlock && 'directAnswer' in structuredBlock ? structuredBlock.directAnswer : '').not.toContain('Key evidence');
        expect(structuredBlock && 'overviewMarkdown' in structuredBlock ? structuredBlock.overviewMarkdown : '').toContain('## Answer Context');
        expect(structuredBlock && 'overviewMarkdown' in structuredBlock ? structuredBlock.overviewMarkdown : '').toContain('Graph-supported relations');
        expect(structuredBlock && 'overviewMarkdown' in structuredBlock ? structuredBlock.overviewMarkdown : '').toContain('Temporal validity');
        expect(structuredBlock && 'explanationMarkdown' in structuredBlock ? structuredBlock.explanationMarkdown : '').toContain('comparison baseline');
        expect(structuredBlock && 'explanationMarkdown' in structuredBlock ? structuredBlock.explanationMarkdown : '').toContain('Graph support around **Reflection** includes');
        expect(structuredBlock && 'explanationMarkdown' in structuredBlock ? structuredBlock.explanationMarkdown : '').toContain('Temporal validity warning');
        expect(structuredBlock && 'nextActionsMarkdown' in structuredBlock ? structuredBlock.nextActionsMarkdown : '').toContain('inspect the strongest nodes side by side');
        expect(structuredBlock && 'nextActionsMarkdown' in structuredBlock ? structuredBlock.nextActionsMarkdown : '').toContain('Persist the latest user focus to scoped conversation memory');
        expect(structuredBlock && 'nextActionsMarkdown' in structuredBlock ? structuredBlock.nextActionsMarkdown : '').toContain('Inspect prerequisite-linked concepts in focus mode before guided learning');
        expect(structuredBlock && 'nextActionsMarkdown' in structuredBlock ? structuredBlock.nextActionsMarkdown : '').toContain('Validate whether a fresher or superseding note should replace this anchor before promotion');
        const actionBlock = reply.assistantBlocks.find((block) => block.type === 'knowledge_actions');
        expect(actionBlock && 'atomIds' in actionBlock ? actionBlock.atomIds : []).toEqual(['atom_a', 'atom_b']);
        expect(collectAgentConversationAtomIds(knowledgePoints)).toEqual(['atom_a', 'atom_b']);
        expect(reply.knowledgeRun.quality.gates).toEqual(expect.arrayContaining([
            expect.objectContaining({
                gateId: 'graph_comparison_branch',
                passed: true,
            }),
        ]));
        expect(reply.answerReleaseReview).toEqual(expect.objectContaining({
            decision: 'revise',
            publicAnswer: reply.answer,
            failedGateIds: expect.arrayContaining(['claim_temporal_validity_consistency']),
        }));
    });

    test('contracts empty-scope draft failures before public release', () => {
        let blockCounter = 0;
        const reply = buildScopedConversationReply({
            message: '什么是waterglass?',
            knowledgePoints: [],
            citations: [],
            recalledMemories: [],
            memoryActions: [],
            usedScope: {
                ...globalScope,
                source: 'scoped',
                workspaceId: 'waterglass',
                corpusId: 'waterglass',
                sourcePathPrefixes: ['Knowledge_Base/waterglass'],
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
            },
            nextBlockId: () => `assistant_block_${++blockCounter}`,
        });

        expect(reply.answer).toContain('waterglass');
        expect(reply.answer).toContain('当前范围');
        expect(reply.answer).not.toContain('No scoped knowledge points matched');
        expect(reply.answer).not.toContain('retrieval');
        expect(reply.answerReleaseReview).toEqual(expect.objectContaining({
            decision: 'abstain',
            publicAnswer: reply.answer,
        }));
        expect(reply.knowledgeRun.answerReleaseReview).toEqual(expect.objectContaining({
            decision: 'abstain',
        }));
    });

    test('uses the explicit Chinese answer language for an English no-match query', () => {
        let blockCounter = 0;
        const reply = buildScopedConversationReply({
            message: 'what is water glass?',
            answerLanguage: 'zh',
            knowledgePoints: [],
            citations: [],
            recalledMemories: [],
            memoryActions: [],
            usedScope: {
                ...globalScope,
                source: 'scoped',
                workspaceId: 'waterglass',
                corpusId: 'waterglass',
                sourcePathPrefixes: ['Knowledge_Base/waterglass'],
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
                    message: 'No evidence-bearing candidates were returned.',
                    query: 'what is water glass?',
                    normalizedQuery: 'what is water glass?',
                    titleLikeQueries: ['water glass'],
                    titleHitDocumentIds: [],
                    indexedScopeAtomCount: 4,
                },
            },
            nextBlockId: () => `language_empty_scope_${++blockCounter}`,
        });

        const structuredAnswer = reply.assistantBlocks.find((block) => block.type === 'structured_answer');
        expect(reply.answer).toContain('当前范围');
        expect(reply.answer).toContain('我暂时不能');
        expect(reply.answer).not.toContain('No scoped knowledge points matched');
        expect(structuredAnswer && 'title' in structuredAnswer ? structuredAnswer.title : '').toBe('可信回答');
        expect(reply.knowledgeRun.answerReleaseReview?.publicAnswer).toBe(reply.answer);
    });

    test('aggregates graph context across multiple knowledge points and preserves temporal edge details', () => {
        const knowledgePoints = [
            {
                atomId: 'atom_anchor',
                atomIds: ['atom_anchor'],
                documentId: 'doc_anchor',
                sourcePath: 'Knowledge_Base/test/anchor.md',
                title: 'Anchor Point',
                summary: 'Anchor summary.',
                evidenceSnippet: 'Anchor summary.',
                score: 0.95,
                citation: null,
                citations: [],
                matchedSpans: [],
                matchCount: 0,
                relationPath: [],
                relationPathAtomIds: [],
                relationKinds: [],
                temporalValidity: {
                    isValid: true,
                    checkedAt: '2026-06-10T09:00:00.000Z',
                    reasons: ['atom_active'],
                    details: [],
                } as any,
                capabilities: [],
            },
            {
                atomId: 'atom_support',
                atomIds: ['atom_support'],
                documentId: 'doc_support',
                sourcePath: 'Knowledge_Base/test/support.md',
                title: 'Support Point',
                summary: 'Support summary.',
                evidenceSnippet: 'Support summary.',
                score: 0.88,
                citation: null,
                citations: [],
                matchedSpans: [],
                matchCount: 0,
                relationPath: [
                    {
                        edgeId: 'edge_support_anchor',
                        sourceAtomId: 'atom_support',
                        targetAtomId: 'atom_anchor',
                        relationKind: 'reference',
                        confidence: 0.87,
                    },
                    {
                        edgeId: 'edge_support_reference',
                        sourceAtomId: 'atom_support',
                        targetAtomId: 'atom_external',
                        relationKind: 'reference',
                        confidence: 0.84,
                    },
                ],
                relationPathAtomIds: ['atom_external'],
                relationKinds: ['reference'],
                temporalValidity: {
                    isValid: false,
                    checkedAt: '2026-06-10T10:00:00.000Z',
                    reasons: ['temporal_edge_expired'],
                    details: [
                        {
                            edgeId: 'temporal_support_supersedes',
                            edgeKind: 'supersedes',
                            sourceAtomId: 'atom_support_older',
                            targetAtomId: 'atom_support',
                            validFrom: '2026-06-09T00:00:00.000Z',
                            isActive: true,
                        },
                    ],
                } as any,
                capabilities: [],
            },
        ] as AgentConversationKnowledgePoint[];

        let blockCounter = 0;
        const reply = buildScopedConversationReply({
            message: 'explain the support point',
            knowledgePoints,
            citations: [],
            recalledMemories: [],
            memoryActions: [],
            usedScope: globalScope,
            nextBlockId: () => `assistant_block_${++blockCounter}`,
        });

        expect(reply.graphContext).not.toBeNull();
        const graphContext = reply.graphContext as NonNullable<typeof reply.graphContext>;
        expect(graphContext.relationKinds).toEqual(expect.arrayContaining(['reference']));
        expect(graphContext.relationSummaries).toEqual(expect.arrayContaining([
            expect.objectContaining({
                relationKind: 'reference',
                targetAtomIds: ['atom_external'],
            }),
        ]));
        expect((graphContext as any).knowledgePointRelations).toEqual(expect.arrayContaining([
            expect.objectContaining({
                relationKind: 'reference',
                sourceAtomId: 'atom_support',
                sourceTitle: 'Support Point',
                targetAtomId: 'atom_anchor',
                targetTitle: 'Anchor Point',
            }),
        ]));
        expect(graphContext.supportingAtomIds).toEqual(expect.arrayContaining(['atom_external']));
        expect(graphContext.supportingTitles).toEqual(expect.arrayContaining(['Support Point']));
        expect(graphContext.temporalValidity).toEqual(expect.objectContaining({
            checkedAt: '2026-06-10T10:00:00.000Z',
            allPointsValid: false,
            warningReasons: ['temporal_edge_expired'],
            invalidKnowledgePointTitles: ['Support Point'],
        }));
        expect((graphContext.temporalValidity as any).edgeKinds).toEqual(expect.arrayContaining(['supersedes']));
        expect((graphContext.temporalValidity as any).details).toEqual(expect.arrayContaining([
            expect.objectContaining({
                edgeId: 'temporal_support_supersedes',
                edgeKind: 'supersedes',
                sourceAtomId: 'atom_support_older',
                targetAtomId: 'atom_support',
            }),
        ]));

        const structuredBlock = reply.assistantBlocks.find((block) => block.type === 'structured_answer');
        expect(structuredBlock && 'overviewMarkdown' in structuredBlock ? structuredBlock.overviewMarkdown : '').toContain('Graph-supported relations');
        expect(structuredBlock && 'explanationMarkdown' in structuredBlock ? structuredBlock.explanationMarkdown : '').toContain('Graph support around **Anchor Point** includes');
        expect(structuredBlock && 'explanationMarkdown' in structuredBlock ? structuredBlock.explanationMarkdown : '').toContain('Support Point -> reference -> Anchor Point');
        expect(structuredBlock && 'explanationMarkdown' in structuredBlock ? structuredBlock.explanationMarkdown : '').toContain('supersedes 1 earlier revision');
        expect(structuredBlock && 'nextActionsMarkdown' in structuredBlock ? structuredBlock.nextActionsMarkdown : '').toContain('Validate whether a fresher or superseding note should replace this anchor before promotion');
        expect(structuredBlock && 'nextActionsMarkdown' in structuredBlock ? structuredBlock.nextActionsMarkdown : '').toContain('Trace the superseded lineage before promoting this answer');
        expect(structuredBlock && 'nextActionsMarkdown' in structuredBlock ? structuredBlock.nextActionsMarkdown : '').toContain('Follow the direct graph path between Support Point and Anchor Point before branching to external support nodes');
    });

    test('uses explicit graph connection paths when provided by the runtime graph context', () => {
        const knowledgePoints = [
            {
                atomId: 'atom_anchor',
                atomIds: ['atom_anchor'],
                documentId: 'doc_anchor',
                sourcePath: 'Knowledge_Base/test/anchor.md',
                title: 'Ground State',
                summary: 'Ground state is the anchor concept.',
                evidenceSnippet: 'Ground state is the anchor concept.',
                score: 0.95,
                citation: null,
                citations: [],
                matchedSpans: [],
                matchCount: 0,
                relationPath: [],
                relationPathAtomIds: [],
                relationKinds: [],
                temporalValidity: {
                    isValid: true,
                    checkedAt: '2026-06-10T09:00:00.000Z',
                    reasons: [],
                    details: [],
                } as any,
                capabilities: [],
            },
        ] as AgentConversationKnowledgePoint[];

        let blockCounter = 0;
        const reply = buildScopedConversationReply({
            message: 'explain ground state from the current graph context',
            knowledgePoints,
            citations: [],
            recalledMemories: [],
            memoryActions: [],
            usedScope: globalScope,
            nextBlockId: () => `assistant_block_${++blockCounter}`,
            graphContext: {
                anchorAtomId: 'atom_anchor',
                anchorTitle: 'Ground State',
                anchorDocumentId: 'doc_anchor',
                supportingAtomIds: ['atom_bridge'],
                supportingTitles: ['Bridge Layer'],
                relationKinds: ['prerequisite'],
                relationSummaries: [
                    {
                        relationKind: 'prerequisite',
                        edgeIds: ['edge_bridge_anchor'],
                        sourceAtomIds: ['atom_bridge'],
                        targetAtomIds: ['atom_anchor'],
                        averageConfidence: 0.9,
                    },
                ],
                knowledgePointRelations: [],
                connectionPaths: [
                    {
                        sourceAtomId: 'atom_foundation',
                        sourceTitle: 'Foundation Note',
                        targetAtomId: 'atom_anchor',
                        targetTitle: 'Ground State',
                        pathAtomIds: ['atom_foundation', 'atom_bridge', 'atom_anchor'],
                        pathTitles: ['Foundation Note', 'Bridge Layer', 'Ground State'],
                        pathEdges: [
                            {
                                fromAtomId: 'atom_foundation',
                                toAtomId: 'atom_bridge',
                                relationKind: 'prerequisite',
                            },
                            {
                                fromAtomId: 'atom_bridge',
                                toAtomId: 'atom_anchor',
                                relationKind: 'reference',
                            },
                        ],
                        length: 2,
                    },
                ],
                predecessorWindow: [
                    {
                        atomId: 'atom_bridge',
                        title: 'Bridge Layer',
                        relationKind: 'prerequisite',
                        confidence: 0.9,
                    },
                ],
                successorWindow: [
                    {
                        atomId: 'atom_application',
                        title: 'Application Example',
                        relationKind: 'sequence',
                        confidence: 0.74,
                    },
                ],
                evidenceSourceRefs: [
                    'Knowledge_Base/optics/foundation.md:4',
                    'Knowledge_Base/optics/ground-state.md:8',
                ],
                diagnostics: {
                    graphOpsAvailable: true,
                    usedFallback: false,
                    selectedAnchorReason: 'title_mention',
                    candidateCount: 3,
                    supportNodeCount: 1,
                    supportNodeLimit: 3,
                    pathDepthLimit: 6,
                    missingConnectionPathSourceAtomIds: [],
                    missingPredecessorAtomIds: [],
                    missingSuccessorAtomIds: [],
                },
                anchorGraphProfile: {
                    atomId: 'atom_anchor',
                    title: 'Ground State',
                    inDegree: 2,
                    outDegree: 1,
                    centrality: 0.81,
                },
                temporalValidity: {
                    checkedAt: '2026-06-10T09:00:00.000Z',
                    allPointsValid: true,
                    warningReasons: [],
                    invalidKnowledgePointTitles: [],
                    edgeKinds: [],
                    details: [],
                },
            } as any,
        } as any);

        expect((reply.graphContext as any)?.connectionPaths).toEqual(expect.arrayContaining([
            expect.objectContaining({
                sourceTitle: 'Foundation Note',
                targetTitle: 'Ground State',
                pathTitles: ['Foundation Note', 'Bridge Layer', 'Ground State'],
                length: 2,
            }),
        ]));

        const structuredBlock = reply.assistantBlocks.find((block) => block.type === 'structured_answer');
        expect(structuredBlock && 'overviewMarkdown' in structuredBlock ? structuredBlock.overviewMarkdown : '').toContain('Explicit connection paths');
        expect(structuredBlock && 'overviewMarkdown' in structuredBlock ? structuredBlock.overviewMarkdown : '').toContain('Immediate predecessors');
        expect(structuredBlock && 'overviewMarkdown' in structuredBlock ? structuredBlock.overviewMarkdown : '').toContain('Immediate successors');
        expect(structuredBlock && 'explanationMarkdown' in structuredBlock ? structuredBlock.explanationMarkdown : '').toContain('Explicit graph path');
        expect(structuredBlock && 'explanationMarkdown' in structuredBlock ? structuredBlock.explanationMarkdown : '').toContain('Foundation Note -> prerequisite -> Bridge Layer -> reference -> Ground State');
        expect(structuredBlock && 'explanationMarkdown' in structuredBlock ? structuredBlock.explanationMarkdown : '').toContain('Immediate predecessor window: Bridge Layer');
        expect(structuredBlock && 'explanationMarkdown' in structuredBlock ? structuredBlock.explanationMarkdown : '').toContain('Immediate successor window: Application Example');
        expect(structuredBlock && 'nextActionsMarkdown' in structuredBlock ? structuredBlock.nextActionsMarkdown : '').toContain('Review the path order: Foundation Note -> Bridge Layer -> Ground State');
        expect(structuredBlock && 'nextActionsMarkdown' in structuredBlock ? structuredBlock.nextActionsMarkdown : '').toContain('Inspect prerequisite context from Bridge Layer');
        expect(structuredBlock && 'nextActionsMarkdown' in structuredBlock ? structuredBlock.nextActionsMarkdown : '').toContain('Use likely next-step nodes such as Application Example');
        expect(reply.answer).toContain('Ground State');
        expect(reply.answer).toContain('Bridge Layer');
        expect(reply.answer).toContain('Application Example');
        expect(reply.answer).toContain('2 incoming');
        expect(reply.answer).toContain('1 outgoing');
        expect(
            reply.answer
                .split(/[.!?\u3002\uFF01\uFF1F]/u)
                .map((sentence) => sentence.trim())
                .filter(Boolean)
                .length
        ).toBeGreaterThanOrEqual(2);
        expect(reply.knowledgeRun.quality.gates).toEqual(expect.arrayContaining([
            expect.objectContaining({ gateId: 'graph_prerequisite_order', passed: true }),
            expect.objectContaining({ gateId: 'graph_op_fallback', passed: true }),
            expect.objectContaining({ gateId: 'graph_budget', passed: true }),
        ]));
    });

    test('filters anchor-equivalent graph neighbors while composing scoped answers', () => {
        const knowledgePoints = [
            {
                atomId: 'atom_water_glass',
                atomIds: ['atom_water_glass'],
                documentId: 'doc_water_glass',
                sourcePath: 'Knowledge_Base/waterglass/water-glass.md',
                title: 'Water Glass',
                summary: 'A water glass is a physical system made of a transparent container and water.',
                evidenceSnippet: 'A water glass is a physical system made of a transparent container and water.',
                score: 0.96,
                citation: null,
                citations: [],
                matchedSpans: [],
                matchCount: 0,
                relationPath: [],
                relationPathAtomIds: [],
                relationKinds: [],
                temporalValidity: {
                    isValid: true,
                    checkedAt: '2026-06-10T09:00:00.000Z',
                    reasons: [],
                    details: [],
                } as any,
                capabilities: [],
            },
        ] as AgentConversationKnowledgePoint[];
        const graphContext: AgentConversationGraphContext = {
            anchorAtomId: 'atom_water_glass',
            anchorTitle: 'Water Glass',
            anchorDocumentId: 'doc_water_glass',
            anchorGraphProfile: {
                atomId: 'atom_water_glass',
                title: 'Water Glass',
                inDegree: 1,
                outDegree: 1,
            },
            supportingAtomIds: ['atom_container_physics', 'atom_mathematical_basis'],
            supportingTitles: ['Container Physics', 'Mathematical Basis'],
            relationKinds: ['prerequisite', 'sequence'],
            relationSummaries: [],
            knowledgePointRelations: [],
            predecessorWindow: [
                {
                    atomId: 'atom_water_glass',
                    title: 'Water Glass',
                    relationKind: 'reference',
                    confidence: 0.99,
                },
                {
                    atomId: 'atom_container_physics',
                    title: 'Container Physics',
                    relationKind: 'prerequisite',
                    confidence: 0.92,
                },
            ],
            successorWindow: [
                {
                    atomId: 'atom_water_glass_alias',
                    title: 'Water Glass',
                    relationKind: 'reference',
                    confidence: 0.98,
                },
                {
                    atomId: 'atom_mathematical_basis',
                    title: 'Mathematical Basis',
                    relationKind: 'sequence',
                    confidence: 0.9,
                },
            ],
            temporalValidity: {
                checkedAt: '2026-06-10T09:00:00.000Z',
                allPointsValid: true,
                warningReasons: [],
                invalidKnowledgePointTitles: [],
                edgeKinds: [],
                details: [],
            },
        };

        let blockCounter = 0;
        const reply = buildScopedConversationReply({
            message: 'what is waterglass?',
            knowledgePoints,
            citations: [],
            recalledMemories: [],
            memoryActions: [],
            usedScope: globalScope,
            nextBlockId: () => `assistant_block_${++blockCounter}`,
            graphContext,
        });

        expect(reply.answer).toContain('Container Physics');
        expect(reply.answer).toContain('Mathematical Basis');
        expect(reply.answer).not.toContain('predecessors include Water Glass');
        expect(reply.answer).not.toContain('next nodes include Water Glass');
        expect(reply.answer.match(/Water Glass has/g) || []).toHaveLength(1);

        const structuredBlock = reply.assistantBlocks.find((block) => block.type === 'structured_answer');
        const explanationMarkdown = structuredBlock && 'explanationMarkdown' in structuredBlock ? structuredBlock.explanationMarkdown : '';
        const nextActionsMarkdown = structuredBlock && 'nextActionsMarkdown' in structuredBlock ? structuredBlock.nextActionsMarkdown : '';
        expect(explanationMarkdown).toContain('Immediate predecessor window: Container Physics.');
        expect(explanationMarkdown).toContain('Immediate successor window: Mathematical Basis.');
        expect(explanationMarkdown).not.toContain('Immediate predecessor window: Water Glass');
        expect(explanationMarkdown).not.toContain('Immediate successor window: Water Glass');
        expect(nextActionsMarkdown).toContain('Inspect prerequisite context from Container Physics');
        expect(nextActionsMarkdown).toContain('Use likely next-step nodes such as Mathematical Basis');
        expect(nextActionsMarkdown).not.toContain('Inspect prerequisite context from Water Glass');
    });

    test('builds a verified knowledge run with evidence quality gates and review cards', () => {
        const knowledgePoints: AgentConversationKnowledgePoint[] = [
            {
                atomId: 'atom_verified',
                atomIds: ['atom_verified'],
                documentId: 'doc_verified',
                sourcePath: 'Knowledge_Base/test/evidence.md',
                title: 'Evidence Ledger',
                summary: 'An evidence ledger links each answer claim back to source spans.',
                evidenceSnippet: 'An evidence ledger links each answer claim back to source spans.',
                score: 0.94,
                citation: {
                    citationId: 'citation_verified',
                    atomId: 'atom_verified',
                    documentId: 'doc_verified',
                    sourcePath: 'Knowledge_Base/test/evidence.md',
                    title: 'Evidence Ledger',
                    snippet: 'An evidence ledger links each answer claim back to source spans.',
                    startLine: 12,
                    endLine: 12,
                    score: 0.94,
                },
                citations: [
                    {
                        citationId: 'citation_verified',
                        atomId: 'atom_verified',
                        documentId: 'doc_verified',
                        sourcePath: 'Knowledge_Base/test/evidence.md',
                        title: 'Evidence Ledger',
                        snippet: 'An evidence ledger links each answer claim back to source spans.',
                        startLine: 12,
                        endLine: 12,
                        score: 0.94,
                    },
                ],
                matchedSpans: [
                    {
                        atomId: 'atom_verified',
                        title: 'Evidence Ledger',
                        snippet: 'An evidence ledger links each answer claim back to source spans.',
                        sourcePath: 'Knowledge_Base/test/evidence.md',
                        startLine: 12,
                        endLine: 12,
                        score: 0.94,
                        citation: {
                            citationId: 'citation_verified',
                            atomId: 'atom_verified',
                            documentId: 'doc_verified',
                            sourcePath: 'Knowledge_Base/test/evidence.md',
                            title: 'Evidence Ledger',
                            snippet: 'An evidence ledger links each answer claim back to source spans.',
                            startLine: 12,
                            endLine: 12,
                            score: 0.94,
                        },
                    },
                ],
                matchCount: 1,
                capabilities: [{ actionId: 'open_focus_mode' }],
            },
        ];
        let blockCounter = 0;
        let runCounter = 0;

        const reply = buildScopedConversationReply({
            message: 'How should knowledge answers prove their claims?',
            knowledgePoints,
            citations: knowledgePoints[0].citations || [],
            recalledMemories: [],
            memoryActions: [],
            usedScope: {
                ...globalScope,
                source: 'scoped',
                workspaceId: 'workspace_verified',
                corpusId: 'corpus_verified',
                matchedAtomCount: 1,
                sourcePathPrefixes: ['Knowledge_Base/test'],
            },
            generatedAt: '2026-06-08T00:00:00.000Z',
            nextBlockId: () => `assistant_block_${++blockCounter}`,
            nextRunId: () => `knowledge_run_${++runCounter}`,
        });

        expect(reply.knowledgeRun.runId).toBe('knowledge_run_1');
        expect(reply.knowledgeRun.status).toBe('pass');
        expect(reply.knowledgeRun.evidenceClaims).toHaveLength(1);
        expect(reply.knowledgeRun.evidenceClaims[0]).toMatchObject({
            status: 'verified',
            citationId: 'citation_verified',
            sourcePath: 'Knowledge_Base/test/evidence.md',
            startLine: 12,
        });
        expect(reply.knowledgeRun.quality.gates).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ gateId: 'evidence_coverage', passed: true }),
                expect.objectContaining({ gateId: 'scope_discipline', passed: true }),
                expect.objectContaining({ gateId: 'recall_transfer', passed: true }),
                expect.objectContaining({ gateId: 'graph_temporal_warning', passed: true }),
                expect.objectContaining({ gateId: 'graph_budget', passed: true }),
            ])
        );
        expect(reply.knowledgeRun.reviewCards).toEqual([
            expect.objectContaining({
                cardId: 'knowledge_run_1_card_1',
                sourceClaimId: reply.knowledgeRun.evidenceClaims[0].claimId,
                evidenceRefs: ['Knowledge_Base/test/evidence.md:12'],
            }),
        ]);
        expect(reply.knowledgeRun.reviewState).toEqual({
            consumedCardIds: [],
            completedReviewCardCount: 0,
            remainingReviewCardCount: 1,
            completedAt: null,
        });
        expect(reply.knowledgeRun.summary.completedReviewCardCount).toBe(0);
        expect(reply.knowledgeRun.summary.remainingReviewCardCount).toBe(1);
        const runBlock = reply.assistantBlocks.find((block) => block.type === 'knowledge_run_summary');
        expect(runBlock).toEqual(expect.objectContaining({
            type: 'knowledge_run_summary',
            title: 'Knowledge Run',
            knowledgeRun: reply.knowledgeRun,
        }));
    });

    test('uses a document-augmented RAG context pack to produce one richer public answer', () => {
        const item = makeQueryItem({
            atom: {
                id: 'atom_rag_water_glass',
                documentId: 'doc_rag_water_glass',
                sourcePath: 'Knowledge_Base/test/water-glass.md',
                title: 'Water Glass',
                content: 'A water glass is a transparent drinking vessel that contains water.',
            },
            evidence: {
                id: 'evidence_rag_water_glass',
                snippet: 'A water glass is a transparent drinking vessel that contains water.',
                startLine: 7,
                endLine: 7,
            },
            score: 0.94,
        });
        const knowledgePoints = mergeAgentConversationKnowledgePoints([item], () => []);
        const citations = knowledgePoints[0].citations || [];
        const ragContextPack: RagContextPack = {
            query: 'what is water glass?',
            generatedAt: '2026-07-05T00:00:00.000Z',
            sourceBoundary: 'full_document',
            budget: {
                maxFragments: 4,
                maxCharsPerFragment: 600,
                maxTotalChars: 1600,
            },
            fragments: [
                {
                    fragmentId: 'rag_direct_water_glass',
                    role: 'direct_support',
                    text: 'A water glass is a transparent drinking vessel that contains water.',
                    atomId: 'atom_rag_water_glass',
                    documentId: 'doc_rag_water_glass',
                    sourcePath: 'Knowledge_Base/test/water-glass.md',
                    title: 'Water Glass',
                    headingPath: ['Water Glass', 'Definition'],
                    startLine: 7,
                    endLine: 7,
                    charCount: 67,
                    tokenEstimate: 17,
                    truncated: false,
                    citationIds: ['evidence_rag_water_glass'],
                    sourceBoundary: 'direct_span_only',
                },
                {
                    fragmentId: 'rag_parent_water_glass',
                    role: 'parent_context',
                    text: '## Definition\n\nA water glass is a transparent drinking vessel that contains water.\n\nThe vessel boundary and the water surface jointly determine the observed optical behavior.',
                    atomId: 'atom_rag_water_glass',
                    documentId: 'doc_rag_water_glass',
                    sourcePath: 'Knowledge_Base/test/water-glass.md',
                    title: 'Water Glass',
                    headingPath: ['Water Glass', 'Definition'],
                    startLine: 5,
                    endLine: 9,
                    charCount: 158,
                    tokenEstimate: 40,
                    truncated: false,
                    citationIds: ['evidence_rag_water_glass'],
                    sourceBoundary: 'full_document',
                },
            ],
            sourceDecisions: [],
            totalCharCount: 225,
            tokenEstimate: 57,
        };
        const ragSufficiencyReview: RagSufficiencyReview = {
            reviewedAt: '2026-07-05T00:00:00.000Z',
            status: 'sufficient',
            score: 0.88,
            reasons: [],
            deterministic: true,
            recoveryAttempted: false,
            llmJudgeUsed: false,
            degradationState: 'none',
        };
        let blockCounter = 0;

        const reply = buildScopedConversationReply({
            message: 'what is water glass?',
            knowledgePoints,
            citations,
            recalledMemories: [],
            memoryActions: [],
            usedScope: globalScope,
            generatedAt: '2026-07-05T00:00:00.000Z',
            nextBlockId: () => `assistant_block_${++blockCounter}`,
            ragContextPack,
            ragSufficiencyReview,
        });

        expect(reply.answer).toContain('transparent drinking vessel');
        expect(reply.answer).toContain('vessel boundary');
        expect(reply.answer).toContain('observed optical behavior');
        expect(reply.assistantBlocks.filter((block) => block.type === 'structured_answer')).toHaveLength(1);
        const structuredBlock = reply.assistantBlocks.find((block) => block.type === 'structured_answer');
        expect(structuredBlock && 'directAnswer' in structuredBlock ? structuredBlock.directAnswer : '').toBe(reply.answer);
    });

    test('full response mode releases a bounded technical report while slim remains concise', () => {
        const item = makeQueryItem({
            atom: {
                id: 'atom_full_water_glass',
                documentId: 'doc_full_water_glass',
                sourcePath: 'Knowledge_Base/test/full-water-glass.md',
                title: 'Water Glass',
                content: 'A water glass is a transparent drinking vessel that contains water.',
            },
            evidence: {
                id: 'evidence_full_water_glass',
                snippet: 'A water glass is a transparent drinking vessel that contains water.',
                startLine: 4,
                endLine: 4,
            },
            score: 0.96,
        });
        const knowledgePoints = mergeAgentConversationKnowledgePoints([item], () => []);
        const citations = knowledgePoints[0].citations || [];
        const ragContextPack: RagContextPack = {
            query: 'what is water glass?',
            generatedAt: '2026-09-03T00:00:00.000Z',
            sourceBoundary: 'full_document',
            budget: {
                maxFragments: 8,
                maxCharsPerFragment: 1600,
                maxTotalChars: 6400,
            },
            fragments: [
                {
                    fragmentId: 'rag_full_definition',
                    role: 'parent_context',
                    text: [
                        '# Water Glass',
                        '',
                        'A water glass is a transparent drinking vessel that contains water.',
                        '',
                        '## Thermal model',
                        '',
                        'The temperature field follows:',
                        '',
                        '$$\n\\frac{\\partial T}{\\partial t} = \\alpha \\nabla^2 T\n$$',
                    ].join('\n'),
                    atomId: item.atom.id,
                    documentId: item.atom.documentId,
                    sourcePath: item.atom.sourcePath,
                    title: item.atom.title,
                    headingPath: ['Water Glass'],
                    startLine: 1,
                    endLine: 10,
                    charCount: 260,
                    tokenEstimate: 65,
                    truncated: false,
                    citationIds: ['evidence_full_water_glass'],
                    sourceBoundary: 'full_document',
                },
                {
                    fragmentId: 'rag_full_optics',
                    role: 'parent_context',
                    text: [
                        '## Optical model',
                        '',
                        'At an interface, refraction follows Snell law:',
                        '',
                        '$$\nn_1 \\sin(\\theta_1) = n_2 \\sin(\\theta_2)\n$$',
                    ].join('\n'),
                    atomId: item.atom.id,
                    documentId: item.atom.documentId,
                    sourcePath: item.atom.sourcePath,
                    title: item.atom.title,
                    headingPath: ['Water Glass', 'Optical model'],
                    startLine: 12,
                    endLine: 18,
                    charCount: 150,
                    tokenEstimate: 38,
                    truncated: false,
                    citationIds: ['evidence_full_water_glass'],
                    sourceBoundary: 'full_document',
                },
                {
                    fragmentId: 'rag_full_comparison',
                    role: 'parent_context',
                    text: [
                        '## Material comparison',
                        '',
                        '```mermaid',
                        'graph LR',
                        '    A[Glass] --> B[Water]',
                        '```',
                        '',
                        'The comparison model relates material conductivity to heat loss.',
                        '',
                        '| Material | Thermal conductivity |',
                        '| --- | --- |',
                        '| Soda-lime glass | 1.0 W/(m·K) |',
                        '| PET plastic | 0.2 W/(m·K) |',
                    ].join('\n'),
                    atomId: item.atom.id,
                    documentId: item.atom.documentId,
                    sourcePath: item.atom.sourcePath,
                    title: 'Material comparison (mermaid block)',
                    headingPath: ['Water Glass', 'Material comparison'],
                    startLine: 20,
                    endLine: 26,
                    charCount: 150,
                    tokenEstimate: 38,
                    truncated: false,
                    citationIds: ['evidence_full_water_glass'],
                    sourceBoundary: 'full_document',
                },
                {
                    fragmentId: 'rag_full_orphan_heading',
                    role: 'parent_context',
                    text: '### References',
                    atomId: item.atom.id,
                    documentId: item.atom.documentId,
                    sourcePath: item.atom.sourcePath,
                    title: item.atom.title,
                    headingPath: ['Water Glass', 'References'],
                    startLine: 30,
                    endLine: 30,
                    charCount: 15,
                    tokenEstimate: 4,
                    truncated: false,
                    citationIds: ['evidence_full_water_glass'],
                    sourceBoundary: 'full_document',
                },
            ],
            sourceDecisions: [],
            totalCharCount: 560,
            tokenEstimate: 141,
        };
        const ragSufficiencyReview: RagSufficiencyReview = {
            reviewedAt: '2026-09-03T00:00:00.000Z',
            status: 'sufficient',
            score: 0.98,
            reasons: [],
            deterministic: true,
            degradationState: 'none',
        };

        const makeReply = (responseMode?: 'slim' | 'full') => buildScopedConversationReply({
            message: 'what is water glass?',
            responseMode,
            knowledgePoints,
            citations,
            recalledMemories: [],
            memoryActions: [],
            usedScope: globalScope,
            generatedAt: '2026-09-03T00:00:00.000Z',
            nextBlockId: (() => {
                let blockCounter = 0;
                return () => `assistant_block_${++blockCounter}`;
            })(),
            ragContextPack,
            ragSufficiencyReview,
        });

        const slimReply = makeReply('slim');
        const fullReply = makeReply('full');
        expect(slimReply.answer).not.toContain('## Material comparison');
        expect(fullReply.answer).toContain('## Thermal model');
        expect(fullReply.answer).toContain('## Optical model');
        expect(fullReply.answer).toContain('## Material comparison');
        expect(fullReply.answer).toContain('comparison model relates material conductivity');
        expect(fullReply.answer).toContain('Soda-lime glass');
        expect(fullReply.answer).not.toMatch(/### References\s*$/u);
        expect(fullReply.answer).toContain('\\frac{\\partial T}{\\partial t}');
        expect(fullReply.answer).toContain('n_1 \\sin(\\theta_1)');
        expect(fullReply.answer.match(/\$\$/gu)?.length).toBe(4);
        expect(fullReply.answer).not.toContain('Grounded by');
        expect(fullReply.answerReleaseReview.decision).not.toBe('abstain');
    });

    test('uses same-document graph-neighbor fragments as full-report section fallbacks', () => {
        const item = makeQueryItem({
            atom: {
                id: 'atom_graph_fallback_water_glass',
                documentId: 'doc_graph_fallback_water_glass',
                sourcePath: 'Knowledge_Base/test/graph-fallback-water-glass.md',
                title: 'Water Glass',
                content: 'A water glass is a transparent drinking vessel that contains water.',
            },
            evidence: {
                id: 'evidence_graph_fallback_water_glass',
                snippet: 'A water glass is a transparent drinking vessel that contains water.',
                startLine: 3,
                endLine: 3,
            },
            score: 0.95,
        });
        const knowledgePoints = mergeAgentConversationKnowledgePoints([item], () => []);
        const citations = knowledgePoints[0].citations || [];
        const makeFragment = (overrides: Partial<RagContextPack['fragments'][number]>): RagContextPack['fragments'][number] => ({
            fragmentId: String(overrides.fragmentId || 'fragment'),
            role: overrides.role || 'parent_context',
            text: String(overrides.text || ''),
            atomId: overrides.atomId || item.atom.id,
            documentId: String(overrides.documentId || item.atom.documentId),
            sourcePath: String(overrides.sourcePath || item.atom.sourcePath),
            title: String(overrides.title || item.atom.title),
            headingPath: Array.isArray(overrides.headingPath) ? overrides.headingPath : ['Water Glass'],
            startLine: overrides.startLine || 1,
            endLine: overrides.endLine || 4,
            charCount: Number(overrides.charCount || String(overrides.text || '').length),
            tokenEstimate: Number(overrides.tokenEstimate || 10),
            truncated: overrides.truncated === true,
            citationIds: Array.isArray(overrides.citationIds) ? overrides.citationIds : ['evidence_graph_fallback_water_glass'],
            sourceBoundary: overrides.sourceBoundary || 'full_document',
        });
        const ragContextPack: RagContextPack = {
            query: 'what is water glass?',
            generatedAt: '2026-09-03T00:00:00.000Z',
            sourceBoundary: 'full_document',
            budget: {
                maxFragments: 6,
                maxCharsPerFragment: 1200,
                maxTotalChars: 3600,
            },
            fragments: [
                makeFragment({
                    fragmentId: 'rag_graph_fallback_definition',
                    role: 'parent_context',
                    text: '## Definition\n\nA water glass is a transparent drinking vessel that contains water.',
                    headingPath: ['Water Glass', 'Definition'],
                }),
                makeFragment({
                    fragmentId: 'rag_graph_fallback_optics',
                    role: 'graph_neighbor_support',
                    text: '## Optical model\n\nRefraction follows Snell law.\n\n$$\nn_1 \\sin(\\theta_1) = n_2 \\sin(\\theta_2)\n$$',
                    headingPath: ['Water Glass', 'Optical model'],
                }),
                makeFragment({
                    fragmentId: 'rag_graph_fallback_unrelated',
                    role: 'graph_neighbor_support',
                    documentId: 'doc_unrelated_graph_neighbor',
                    sourcePath: 'Knowledge_Base/test/unrelated.md',
                    text: '## Unrelated model\n\nThis cross-document marker must not leak into the water-glass report.',
                    headingPath: ['Unrelated', 'Unrelated model'],
                }),
            ],
            sourceDecisions: [],
            totalCharCount: 300,
            tokenEstimate: 75,
        };
        const reply = buildScopedConversationReply({
            message: 'what is water glass?',
            responseMode: 'full',
            knowledgePoints,
            citations,
            recalledMemories: [],
            memoryActions: [],
            usedScope: globalScope,
            generatedAt: '2026-09-03T00:00:00.000Z',
            nextBlockId: (() => {
                let blockCounter = 0;
                return () => `assistant_block_${++blockCounter}`;
            })(),
            ragContextPack,
            ragSufficiencyReview: {
                reviewedAt: '2026-09-03T00:00:00.000Z',
                status: 'sufficient',
                score: 0.95,
                reasons: [],
                deterministic: true,
                degradationState: 'none',
            },
        });

        expect(reply.answer).toContain('## Optical model');
        expect(reply.answer).toContain('n_1 \\sin(\\theta_1)');
        expect(reply.answer).not.toContain('cross-document marker');
        expect(reply.answerReleaseReview.decision).not.toBe('abstain');
    });

    test('keeps decimal numeric evidence intact in RAG public answers', () => {
        const item = makeQueryItem({
            atom: {
                id: 'atom_rag_conflict_tolerance',
                documentId: 'doc_rag_conflict_tolerance',
                sourcePath: 'Knowledge_Base/ragconflict/calibration tolerance conflict probe.md',
                title: 'Calibration Tolerance Conflict Probe',
                content: 'The calibration tolerance is +/-0.10 mm in the nominal bench procedure. The calibration tolerance is +/-0.50 mm in the field override note.',
                keywords: ['calibration', 'tolerance', 'conflict'],
            },
            evidence: {
                id: 'evidence_rag_conflict_tolerance',
                snippet: 'The calibration tolerance is +/-0.10 mm in the nominal bench procedure. The calibration tolerance is +/-0.50 mm in the field override note.',
                startLine: 5,
                endLine: 6,
            },
            score: 0.94,
        });
        const knowledgePoints = mergeAgentConversationKnowledgePoints([item], () => []);
        const citations = knowledgePoints[0].citations || [];
        const ragContextPack: RagContextPack = {
            query: 'what is calibration tolerance conflict probe?',
            generatedAt: '2026-07-05T00:00:00.000Z',
            sourceBoundary: 'full_document',
            budget: {
                maxFragments: 4,
                maxCharsPerFragment: 600,
                maxTotalChars: 1600,
            },
            fragments: [
                {
                    fragmentId: 'rag_direct_conflict_tolerance',
                    role: 'direct_support',
                    text: 'The calibration tolerance is +/-0.10 mm in the nominal bench procedure. The calibration tolerance is +/-0.50 mm in the field override note.',
                    atomId: 'atom_rag_conflict_tolerance',
                    documentId: 'doc_rag_conflict_tolerance',
                    sourcePath: 'Knowledge_Base/ragconflict/calibration tolerance conflict probe.md',
                    title: 'Calibration Tolerance Conflict Probe',
                    headingPath: ['Calibration Tolerance Conflict Probe', 'Tolerance Statements'],
                    startLine: 5,
                    endLine: 6,
                    charCount: 139,
                    tokenEstimate: 35,
                    truncated: false,
                    citationIds: ['evidence_rag_conflict_tolerance'],
                    sourceBoundary: 'direct_span_only',
                },
                {
                    fragmentId: 'rag_conflict_tolerance',
                    role: 'conflict',
                    text: 'Conflicting evidence for calibration tolerance:\nThe calibration tolerance is +/-0.10 mm in the nominal bench procedure.\nThe calibration tolerance is +/-0.50 mm in the field override note.',
                    atomId: 'atom_rag_conflict_tolerance',
                    documentId: 'doc_rag_conflict_tolerance',
                    sourcePath: 'Knowledge_Base/ragconflict/calibration tolerance conflict probe.md',
                    title: 'Calibration Tolerance Conflict Probe',
                    headingPath: ['Calibration Tolerance Conflict Probe', 'Tolerance Statements'],
                    startLine: 5,
                    endLine: 6,
                    charCount: 174,
                    tokenEstimate: 44,
                    truncated: false,
                    citationIds: ['evidence_rag_conflict_tolerance'],
                    sourceBoundary: 'full_document',
                },
            ],
            sourceDecisions: [],
            totalCharCount: 139,
            tokenEstimate: 35,
        };
        const ragSufficiencyReview: RagSufficiencyReview = {
            reviewedAt: '2026-07-05T00:00:00.000Z',
            status: 'borderline',
            score: 0.7,
            reasons: ['conflict_evidence_present'],
            deterministic: true,
            recoveryAttempted: false,
            llmJudgeUsed: false,
            degradationState: 'conflict',
        };
        let blockCounter = 0;

        const reply = buildScopedConversationReply({
            message: 'what is calibration tolerance conflict probe?',
            knowledgePoints,
            citations,
            recalledMemories: [],
            memoryActions: [],
            usedScope: globalScope,
            generatedAt: '2026-07-05T00:00:00.000Z',
            nextBlockId: () => `assistant_block_${++blockCounter}`,
            ragContextPack,
            ragSufficiencyReview,
        });

        expect(reply.answer).toContain('+/-0.10 mm');
        expect(reply.answer).toContain('+/-0.50 mm');
        expect(reply.answer).not.toContain('+/-0. 10 mm');
    });

    test('uses compare RAG profile to include direct evidence for both compared sides', () => {
        const waterGlassItem = makeQueryItem({
            atom: {
                id: 'atom_compare_water_glass',
                documentId: 'doc_compare_water_glass',
                sourcePath: 'Knowledge_Base/test/water-glass.md',
                title: 'Water Glass',
                content: 'A water glass is a transparent drinking vessel with a rigid rim.',
            },
            evidence: {
                id: 'evidence_compare_water_glass',
                snippet: 'A water glass is a transparent drinking vessel with a rigid rim.',
                startLine: 7,
                endLine: 7,
            },
            score: 0.94,
        });
        const plasticCupItem = makeQueryItem({
            atom: {
                id: 'atom_compare_plastic_cup',
                documentId: 'doc_compare_plastic_cup',
                sourcePath: 'Knowledge_Base/test/plastic-cup.md',
                title: 'Plastic Cup',
                content: 'A plastic cup is an opaque polymer vessel that can deform under pressure.',
            },
            evidence: {
                id: 'evidence_compare_plastic_cup',
                snippet: 'A plastic cup is an opaque polymer vessel that can deform under pressure.',
                startLine: 9,
                endLine: 9,
            },
            score: 0.92,
            relationPath: [
                {
                    id: 'edge_water_glass_plastic_cup',
                    sourceAtomId: 'atom_compare_water_glass',
                    targetAtomId: 'atom_compare_plastic_cup',
                    relationKind: 'contrast',
                    confidence: 0.87,
                    provenance: 'fact',
                },
            ],
        });
        const knowledgePoints = mergeAgentConversationKnowledgePoints([waterGlassItem, plasticCupItem], () => []);
        const citations = knowledgePoints.flatMap((point) => point.citations || []);
        const ragContextPack: RagContextPack = {
            query: 'compare water glass and plastic cup',
            generatedAt: '2026-07-05T00:00:00.000Z',
            sourceBoundary: 'full_document',
            budget: {
                maxFragments: 4,
                maxCharsPerFragment: 600,
                maxTotalChars: 1600,
            },
            fragments: [
                {
                    fragmentId: 'rag_direct_water_glass_compare',
                    role: 'direct_support',
                    text: 'A water glass is a transparent drinking vessel with a rigid rim.',
                    atomId: 'atom_compare_water_glass',
                    documentId: 'doc_compare_water_glass',
                    sourcePath: 'Knowledge_Base/test/water-glass.md',
                    title: 'Water Glass',
                    headingPath: ['Water Glass', 'Definition'],
                    startLine: 7,
                    endLine: 7,
                    charCount: 65,
                    tokenEstimate: 16,
                    truncated: false,
                    citationIds: ['evidence_compare_water_glass'],
                    sourceBoundary: 'direct_span_only',
                },
                {
                    fragmentId: 'rag_direct_plastic_cup_compare',
                    role: 'direct_support',
                    text: 'A plastic cup is an opaque polymer vessel that can deform under pressure.',
                    atomId: 'atom_compare_plastic_cup',
                    documentId: 'doc_compare_plastic_cup',
                    sourcePath: 'Knowledge_Base/test/plastic-cup.md',
                    title: 'Plastic Cup',
                    headingPath: ['Plastic Cup', 'Definition'],
                    startLine: 9,
                    endLine: 9,
                    charCount: 71,
                    tokenEstimate: 17,
                    truncated: false,
                    citationIds: ['evidence_compare_plastic_cup'],
                    sourceBoundary: 'direct_span_only',
                },
                {
                    fragmentId: 'rag_graph_water_glass_plastic_cup_compare',
                    role: 'graph_neighbor_support',
                    text: 'The graph marks the two nodes with a contrast relation, so the comparison should preserve their material and rigidity differences.',
                    atomId: 'atom_compare_plastic_cup',
                    documentId: 'doc_compare_plastic_cup',
                    sourcePath: 'Knowledge_Base/test/plastic-cup.md',
                    title: 'Plastic Cup',
                    headingPath: ['Plastic Cup', 'Graph Links'],
                    startLine: 14,
                    endLine: 14,
                    charCount: 124,
                    tokenEstimate: 29,
                    truncated: false,
                    citationIds: ['evidence_compare_plastic_cup'],
                    relationEdgeIds: ['edge_water_glass_plastic_cup'],
                    sourceBoundary: 'full_document',
                },
            ],
            sourceDecisions: [],
            totalCharCount: 260,
            tokenEstimate: 62,
        };
        const ragSufficiencyReview: RagSufficiencyReview = {
            reviewedAt: '2026-07-05T00:00:00.000Z',
            status: 'sufficient',
            score: 0.9,
            reasons: [],
            deterministic: true,
            recoveryAttempted: false,
            llmJudgeUsed: false,
            degradationState: 'none',
        };
        let blockCounter = 0;

        const reply = buildScopedConversationReply({
            message: 'compare water glass and plastic cup',
            knowledgePoints,
            citations,
            recalledMemories: [],
            memoryActions: [],
            usedScope: globalScope,
            generatedAt: '2026-07-05T00:00:00.000Z',
            nextBlockId: () => `assistant_block_${++blockCounter}`,
            ragContextPack,
            ragSufficiencyReview,
        });

        expect(reply.answer).toContain('transparent drinking vessel');
        expect(reply.graphAnswerPlan.claims.map((claim) => claim.statement)).toContain(
            'A plastic cup is an opaque polymer vessel that can deform under pressure.'
        );
        expect(reply.graphAnswerPlan.claims.map((claim) => claim.statement)).toContain(
            'The graph marks the two nodes with a contrast relation, so the comparison should preserve their material and rigidity differences.'
        );
        expect(reply.answer).toContain('opaque polymer vessel');
        expect(reply.answer).toContain('contrast relation');
        expect(reply.assistantBlocks.filter((block) => block.type === 'structured_answer')).toHaveLength(1);
        const structuredBlock = reply.assistantBlocks.find((block) => block.type === 'structured_answer');
        expect(structuredBlock && 'directAnswer' in structuredBlock ? structuredBlock.directAnswer : '').toBe(reply.answer);
    });

    test('ranks compare RAG evidence by query operands and keeps Mermaid label evidence readable', () => {
        const item = makeQueryItem({
            atom: {
                id: 'atom_compare_mermaid_water_glass',
                documentId: 'doc_compare_mermaid_water_glass',
                sourcePath: 'Knowledge_Base/test/water-glass.md',
                title: 'Water Glass',
                content: 'Water glass comparison evidence includes plastic cup material properties.',
            },
            evidence: {
                id: 'evidence_compare_mermaid_water_glass',
                snippet: 'Water glass comparison evidence includes Plastic Cup PET.',
                startLine: 12,
                endLine: 18,
            },
            score: 0.94,
        });
        const knowledgePoints = mergeAgentConversationKnowledgePoints([item], () => []);
        const citations = knowledgePoints.flatMap((point) => point.citations || []);
        const ragContextPack: RagContextPack = {
            query: 'compare water glass and plastic cup',
            generatedAt: '2026-07-05T00:00:00.000Z',
            sourceBoundary: 'full_document',
            budget: {
                maxFragments: 4,
                maxCharsPerFragment: 800,
                maxTotalChars: 2400,
            },
            fragments: [
                {
                    fragmentId: 'rag_direct_preamble_compare',
                    role: 'direct_support',
                    text: 'This document was generated from the title water glass and starts with a broad technical preamble.',
                    atomId: 'atom_compare_mermaid_water_glass',
                    documentId: 'doc_compare_mermaid_water_glass',
                    sourcePath: 'Knowledge_Base/test/water-glass.md',
                    title: 'Water Glass',
                    headingPath: ['Water Glass'],
                    startLine: 1,
                    endLine: 2,
                    charCount: 92,
                    tokenEstimate: 20,
                    truncated: false,
                    citationIds: ['evidence_compare_mermaid_water_glass'],
                    sourceBoundary: 'direct_span_only',
                },
                {
                    fragmentId: 'rag_direct_mermaid_compare',
                    role: 'direct_support',
                    text: [
                        '### Container comparison',
                        '```mermaid',
                        'graph LR',
                        'A[Water Glass Soda-Lime]',
                        'B[Plastic Cup PET]',
                        'A -- "high stiffness and brittleness" --> A1["rigid transparent vessel"]',
                        'B -- "lower stiffness and ductility" --> B1["deformable polymer vessel"]',
                        '```',
                    ].join('\n'),
                    atomId: 'atom_compare_mermaid_water_glass',
                    documentId: 'doc_compare_mermaid_water_glass',
                    sourcePath: 'Knowledge_Base/test/water-glass.md',
                    title: 'Container comparison',
                    headingPath: ['Water Glass', 'Container comparison'],
                    startLine: 12,
                    endLine: 18,
                    charCount: 228,
                    tokenEstimate: 52,
                    truncated: false,
                    citationIds: ['evidence_compare_mermaid_water_glass'],
                    sourceBoundary: 'direct_span_only',
                },
            ],
            sourceDecisions: [],
            totalCharCount: 320,
            tokenEstimate: 72,
        };
        const ragSufficiencyReview: RagSufficiencyReview = {
            reviewedAt: '2026-07-05T00:00:00.000Z',
            status: 'sufficient',
            score: 0.9,
            reasons: [],
            deterministic: true,
            recoveryAttempted: false,
            llmJudgeUsed: false,
            degradationState: 'none',
        };
        let blockCounter = 0;

        const reply = buildScopedConversationReply({
            message: 'compare water glass and plastic cup',
            knowledgePoints,
            citations,
            recalledMemories: [],
            memoryActions: [],
            usedScope: globalScope,
            generatedAt: '2026-07-05T00:00:00.000Z',
            nextBlockId: () => `assistant_block_${++blockCounter}`,
            ragContextPack,
            ragSufficiencyReview,
        });

        expect(reply.graphAnswerPlan.claims.map((claim) => claim.statement)).toEqual(expect.arrayContaining([
            'Water Glass Soda-Lime',
            'Plastic Cup PET',
        ]));
        expect(reply.answerReleaseReview.originalAnswer).toContain('Water Glass Soda-Lime');
        expect(reply.answerReleaseReview.gates.filter((gate) => !gate.passed)).toEqual([]);
        expect(reply.answer).toContain('Water Glass Soda-Lime');
        expect(reply.answer).toContain('Plastic Cup PET');
        expect(reply.answer).not.toContain('```');
    });

    test('bounds a full-document comparison to both requested operands instead of preamble context', () => {
        const point: AgentConversationKnowledgePoint = {
            atomId: 'atom_full_compare_water_glass',
            atomIds: ['atom_full_compare_water_glass'],
            documentId: 'doc_full_compare_water_glass',
            sourcePath: 'Knowledge_Base/waterglass/water glass.md',
            title: '\u6c34\u676f (water glass)',
            summary: '\u6c34\u676f\u662f\u7531\u73bb\u7483\u5bb9\u5668\u4e0e\u6c34\u7ec4\u6210\u7684\u7269\u7406\u7cfb\u7edf\u3002',
            evidenceSnippet: '\u6c34\u676f\u662f\u7531\u73bb\u7483\u5bb9\u5668\u4e0e\u6c34\u7ec4\u6210\u7684\u7269\u7406\u7cfb\u7edf\u3002',
            score: 0.98,
            citation: null,
            citations: [],
            matchedSpans: [],
            matchCount: 1,
            relationPath: [],
            relationPathAtomIds: [],
            relationKinds: [],
            temporalValidity: {
                isValid: true,
                checkedAt: '2026-09-01T00:00:00.000Z',
                reasons: [],
                details: [],
            },
            capabilities: [],
        };
        const documentId = 'doc_full_compare_water_glass';
        const sourcePath = 'Knowledge_Base/waterglass/water glass.md';
        const graphContext: AgentConversationGraphContext = {
            anchorAtomId: point.atomId,
            anchorTitle: point.title,
            anchorDocumentId: documentId,
            supportingAtomIds: [],
            supportingTitles: [],
            relationKinds: [],
            relationSummaries: [],
            connectionPaths: [{
                sourceAtomId: 'atom_full_compare_water_glass',
                sourceTitle: 'Temporal Current Release Source',
                targetAtomId: 'atom_full_compare_water_glass',
                targetTitle: 'Temporal Planned Roadmap Source',
                pathAtomIds: ['atom_full_compare_water_glass'],
                pathTitles: ['Temporal Current Release Source', 'Temporal Planned Roadmap Source'],
                pathEdges: [{
                    fromAtomId: 'atom_full_compare_water_glass',
                    toAtomId: 'atom_full_compare_water_glass',
                    relationKind: 'contrast',
                }],
                length: 1,
            }],
            predecessorWindow: [{
                atomId: 'atom_full_compare_water_glass',
                title: 'Temporal Current Release Source',
                relationKind: 'contrast',
                confidence: 0.9,
            }],
            successorWindow: [{
                atomId: 'atom_full_compare_water_glass',
                title: 'Temporal Planned Roadmap Source',
                relationKind: 'contrast',
                confidence: 0.9,
            }],
            temporalValidity: {
                checkedAt: '2026-09-01T00:00:00.000Z',
                allPointsValid: true,
                warningReasons: [],
                invalidKnowledgePointTitles: [],
                edgeKinds: [],
                details: [],
            },
        };
        const ragContextPack: RagContextPack = {
            query: 'compare water glass and plastic cup',
            generatedAt: '2026-09-01T00:00:00.000Z',
            sourceBoundary: 'full_document',
            budget: { maxFragments: 8, maxCharsPerFragment: 1200, maxTotalChars: 4800 },
            fragments: [
                {
                    fragmentId: 'full_compare_definition',
                    role: 'direct_support',
                    text: '## Water Glass\n\nA water glass is a transparent vessel made from soda-lime glass.',
                    atomId: point.atomId,
                    documentId,
                    sourcePath,
                    title: 'Water Glass',
                    headingPath: ['Water Glass'],
                    charCount: 86,
                    tokenEstimate: 22,
                    truncated: false,
                    citationIds: ['full_compare_definition'],
                    relationEdgeIds: [],
                    sourceBoundary: 'full_document',
                    score: 0.98,
                },
                {
                    fragmentId: 'full_compare_preamble',
                    role: 'direct_support',
                    text: 'This technical document was generated from the title water glass and provides broad background context.',
                    atomId: point.atomId,
                    documentId,
                    sourcePath,
                    title: 'water glass.md preamble',
                    headingPath: ['preamble'],
                    charCount: 104,
                    tokenEstimate: 26,
                    truncated: false,
                    citationIds: ['full_compare_preamble'],
                    relationEdgeIds: [],
                    sourceBoundary: 'full_document',
                    score: 0.8,
                },
                {
                    fragmentId: 'full_compare_mermaid',
                    role: 'direct_support',
                    text: [
                        '### Container comparison',
                        '```mermaid',
                        'graph LR',
                        'A[Water Glass Soda-Lime]',
                        'B[Plastic Cup PET]',
                        '```',
                    ].join('\n'),
                    atomId: point.atomId,
                    documentId,
                    sourcePath,
                    title: 'Container comparison',
                    headingPath: ['Water Glass', 'Container comparison'],
                    charCount: 112,
                    tokenEstimate: 28,
                    truncated: false,
                    citationIds: ['full_compare_mermaid'],
                    relationEdgeIds: [],
                    sourceBoundary: 'full_document',
                    score: 0.95,
                },
            ],
            sourceDecisions: [],
            totalCharCount: 302,
            tokenEstimate: 76,
        };

        const reply = buildScopedConversationReply({
            message: 'compare water glass and plastic cup',
            knowledgePoints: [point],
            citations: [],
            recalledMemories: [],
            memoryActions: [],
            usedScope: globalScope,
            generatedAt: '2026-09-01T00:00:00.000Z',
            nextBlockId: (() => {
                let index = 0;
                return () => `full_compare_block_${++index}`;
            })(),
            graphContext,
            ragContextPack,
            ragSufficiencyReview: {
                reviewedAt: '2026-09-01T00:00:00.000Z',
                status: 'sufficient',
                score: 0.94,
                reasons: [],
                deterministic: true,
                recoveryAttempted: false,
                llmJudgeUsed: false,
                degradationState: 'none',
            },
        });

        expect(reply.answer).toContain('Water Glass Soda-Lime');
        expect(reply.answer).toContain('Plastic Cup PET');
        expect(reply.answer).not.toContain('This technical document was generated from the title');
        expect(reply.answerReleaseReview.gates.filter((gate) => !gate.passed)).toEqual([]);
    });

    test('uses how-to RAG profile to preserve steps prerequisites downstream checks and failure handling', () => {
        const item = makeQueryItem({
            atom: {
                id: 'atom_howto_prism_alignment',
                documentId: 'doc_howto_prism_alignment',
                sourcePath: 'Knowledge_Base/test/prism-alignment.md',
                title: 'Prism Alignment',
                content: 'Prism alignment describes how to calibrate an optical bench without drifting the beam.',
            },
            evidence: {
                id: 'evidence_howto_prism_alignment',
                snippet: 'Step 1: clean the lens mount before calibration.',
                startLine: 8,
                endLine: 14,
            },
            score: 0.94,
        });
        const knowledgePoints = mergeAgentConversationKnowledgePoints([item], () => []);
        const citations = knowledgePoints.flatMap((point) => point.citations || []);
        const ragContextPack: RagContextPack = {
            query: 'how to calibrate prism alignment?',
            generatedAt: '2026-07-05T00:00:00.000Z',
            sourceBoundary: 'full_document',
            budget: {
                maxFragments: 4,
                maxCharsPerFragment: 900,
                maxTotalChars: 2600,
            },
            fragments: [
                {
                    fragmentId: 'rag_direct_prism_overview',
                    role: 'direct_support',
                    text: [
                        'Prism alignment is a maintenance procedure for optical benches.',
                        'Step 1: clean the lens mount before calibration.',
                        'Step 2: lock the clamp before measuring beam position.',
                    ].join(' '),
                    atomId: 'atom_howto_prism_alignment',
                    documentId: 'doc_howto_prism_alignment',
                    sourcePath: 'Knowledge_Base/test/prism-alignment.md',
                    title: 'Prism Alignment',
                    headingPath: ['Prism Alignment', 'Procedure'],
                    startLine: 8,
                    endLine: 10,
                    charCount: 155,
                    tokenEstimate: 36,
                    truncated: false,
                    citationIds: ['evidence_howto_prism_alignment'],
                    sourceBoundary: 'direct_span_only',
                },
                {
                    fragmentId: 'rag_parent_prism_prerequisite',
                    role: 'parent_context',
                    text: [
                        'Prerequisite: use a stable bench and confirm the laser is off before touching the mount.',
                        'Background: this section explains why repeated calibration records matter for lab notebooks.',
                    ].join(' '),
                    atomId: 'atom_howto_prism_alignment',
                    documentId: 'doc_howto_prism_alignment',
                    sourcePath: 'Knowledge_Base/test/prism-alignment.md',
                    title: 'Prism Alignment',
                    headingPath: ['Prism Alignment', 'Prerequisites'],
                    startLine: 4,
                    endLine: 7,
                    charCount: 177,
                    tokenEstimate: 40,
                    truncated: false,
                    citationIds: ['evidence_howto_prism_alignment'],
                    sourceBoundary: 'full_document',
                },
                {
                    fragmentId: 'rag_graph_prism_downstream',
                    role: 'graph_neighbor_support',
                    text: [
                        'Downstream check: verify beam drift after the clamp is locked.',
                        'Failure mode: if the beam drifts, repeat clamp inspection before measuring.',
                    ].join(' '),
                    atomId: 'atom_howto_prism_alignment',
                    documentId: 'doc_howto_prism_alignment',
                    sourcePath: 'Knowledge_Base/test/prism-alignment.md',
                    title: 'Beam Drift Check',
                    headingPath: ['Prism Alignment', 'Verification'],
                    startLine: 15,
                    endLine: 18,
                    charCount: 139,
                    tokenEstimate: 31,
                    truncated: false,
                    citationIds: ['evidence_howto_prism_alignment'],
                    relationEdgeIds: ['edge_prism_alignment_beam_drift'],
                    sourceBoundary: 'full_document',
                },
            ],
            sourceDecisions: [],
            totalCharCount: 471,
            tokenEstimate: 107,
        };
        const ragSufficiencyReview: RagSufficiencyReview = {
            reviewedAt: '2026-07-05T00:00:00.000Z',
            status: 'sufficient',
            score: 0.9,
            reasons: [],
            deterministic: true,
            recoveryAttempted: false,
            llmJudgeUsed: false,
            degradationState: 'none',
        };
        let blockCounter = 0;

        const reply = buildScopedConversationReply({
            message: 'how to calibrate prism alignment?',
            knowledgePoints,
            citations,
            recalledMemories: [],
            memoryActions: [],
            usedScope: globalScope,
            generatedAt: '2026-07-05T00:00:00.000Z',
            nextBlockId: () => `assistant_block_${++blockCounter}`,
            ragContextPack,
            ragSufficiencyReview,
        });

        expect(reply.answer).toContain('Step 1: clean the lens mount');
        expect(reply.answer).toContain('Step 2: lock the clamp');
        expect(reply.answer).toContain('use a stable bench');
        expect(reply.answer).toContain('verify beam drift');
        expect(reply.answer).toContain('if the beam drifts');
        expect(reply.answer).not.toContain('Prerequisite:');
        expect(reply.answer).not.toContain('Downstream check:');
        expect(reply.answer).not.toContain('Failure mode:');
        expect(reply.assistantBlocks.filter((block) => block.type === 'structured_answer')).toHaveLength(1);
        const structuredBlock = reply.assistantBlocks.find((block) => block.type === 'structured_answer');
        expect(structuredBlock && 'directAnswer' in structuredBlock ? structuredBlock.directAnswer : '').toBe(reply.answer);
    });

    test('uses causal RAG profile to preserve mechanism evidence and graph consequences', () => {
        const item = makeQueryItem({
            atom: {
                id: 'atom_causal_beam_drift',
                documentId: 'doc_causal_beam_drift',
                sourcePath: 'Knowledge_Base/test/beam-drift-cause.md',
                title: 'Beam Drift Cause',
                content: 'Beam drift occurs when clamp relaxation changes the prism angle.',
            },
            evidence: {
                id: 'evidence_causal_beam_drift',
                snippet: 'Beam drift occurs because clamp relaxation changes the prism angle.',
                startLine: 8,
                endLine: 14,
            },
            score: 0.95,
        });
        const knowledgePoints = mergeAgentConversationKnowledgePoints([item], () => []);
        const citations = knowledgePoints.flatMap((point) => point.citations || []);
        const ragContextPack: RagContextPack = {
            query: 'why does beam drift happen?',
            generatedAt: '2026-07-05T00:00:00.000Z',
            sourceBoundary: 'full_document',
            budget: {
                maxFragments: 6,
                maxCharsPerFragment: 900,
                maxTotalChars: 3000,
            },
            fragments: [
                {
                    fragmentId: 'rag_direct_beam_drift_cause',
                    role: 'direct_support',
                    text: [
                        'Beam drift occurs because clamp relaxation changes the prism angle.',
                        'The angle change moves the beam centroid away from the reference mark.',
                    ].join(' '),
                    atomId: 'atom_causal_beam_drift',
                    documentId: 'doc_causal_beam_drift',
                    sourcePath: 'Knowledge_Base/test/beam-drift-cause.md',
                    title: 'Beam Drift Cause',
                    headingPath: ['Beam Drift Cause', 'Cause'],
                    startLine: 8,
                    endLine: 10,
                    charCount: 132,
                    tokenEstimate: 32,
                    truncated: false,
                    citationIds: ['evidence_causal_beam_drift'],
                    sourceBoundary: 'direct_span_only',
                },
                {
                    fragmentId: 'rag_parent_beam_drift_mechanism',
                    role: 'parent_context',
                    text: [
                        'Mechanism: thermal cycling loosens the clamp before the operator notices visual displacement.',
                        'Reasoning boundary: the source ties the symptom to mechanical relaxation, not sensor firmware.',
                    ].join(' '),
                    atomId: 'atom_causal_beam_drift',
                    documentId: 'doc_causal_beam_drift',
                    sourcePath: 'Knowledge_Base/test/beam-drift-cause.md',
                    title: 'Beam Drift Cause',
                    headingPath: ['Beam Drift Cause', 'Mechanism'],
                    startLine: 4,
                    endLine: 7,
                    charCount: 178,
                    tokenEstimate: 42,
                    truncated: false,
                    citationIds: ['evidence_causal_beam_drift'],
                    sourceBoundary: 'full_document',
                },
                {
                    fragmentId: 'rag_graph_beam_drift_consequence',
                    role: 'graph_neighbor_support',
                    text: [
                        'Downstream consequence: centroid drift invalidates the calibration reading.',
                        'Mitigation neighbor: re-locking the clamp restores the reference beam path.',
                    ].join(' '),
                    atomId: 'atom_beam_drift_downstream',
                    documentId: 'doc_beam_drift_downstream',
                    sourcePath: 'Knowledge_Base/test/beam-drift-downstream.md',
                    title: 'Beam Drift Downstream',
                    headingPath: ['Beam Drift Downstream'],
                    startLine: 3,
                    endLine: 8,
                    charCount: 139,
                    tokenEstimate: 34,
                    truncated: false,
                    citationIds: ['evidence_causal_beam_drift'],
                    relationEdgeIds: ['edge_beam_drift_causal_downstream'],
                    sourceBoundary: 'full_document',
                },
            ],
            sourceDecisions: [],
            totalCharCount: 449,
            tokenEstimate: 108,
        };
        const ragSufficiencyReview: RagSufficiencyReview = {
            reviewedAt: '2026-07-05T00:00:00.000Z',
            status: 'sufficient',
            score: 0.92,
            reasons: [],
            deterministic: true,
            recoveryAttempted: false,
            llmJudgeUsed: false,
            degradationState: 'none',
        };
        let blockCounter = 0;

        const reply = buildScopedConversationReply({
            message: 'why does beam drift happen?',
            knowledgePoints,
            citations,
            recalledMemories: [],
            memoryActions: [],
            usedScope: globalScope,
            generatedAt: '2026-07-05T00:00:00.000Z',
            nextBlockId: () => `assistant_block_${++blockCounter}`,
            ragContextPack,
            ragSufficiencyReview,
        });

        expect(reply.answer).toContain('Beam drift occurs because clamp relaxation changes the prism angle');
        expect(reply.answer).toContain('The angle change moves the beam centroid');
        expect(reply.answer).toContain('thermal cycling loosens the clamp');
        expect(reply.answer).toContain('the source ties the symptom');
        expect(reply.answer).toContain('centroid drift invalidates the calibration reading');
        expect(reply.answer).toContain('re-locking the clamp restores the reference beam path');
        expect(reply.answer).not.toContain('Mechanism:');
        expect(reply.answer).not.toContain('Reasoning boundary:');
        expect(reply.answer).not.toContain('Downstream consequence:');
        expect(reply.answer).not.toContain('Mitigation neighbor:');
    });

    test('uses generic RAG profile to rank direct evidence by query coverage', () => {
        const item = makeQueryItem({
            atom: {
                id: 'atom_generic_optical_bench_drift',
                documentId: 'doc_generic_optical_bench_drift',
                sourcePath: 'Knowledge_Base/test/optical-bench-drift.md',
                title: 'Optical Bench Drift',
                content: 'Optical bench drift changes beam measurements over time.',
            },
            evidence: {
                id: 'evidence_generic_optical_bench_drift',
                snippet: 'Optical bench drift is detected by comparing the reference beam against the current beam centroid.',
                startLine: 6,
                endLine: 11,
            },
            score: 0.93,
        });
        const knowledgePoints = mergeAgentConversationKnowledgePoints([item], () => []);
        const citations = knowledgePoints.flatMap((point) => point.citations || []);
        const ragContextPack: RagContextPack = {
            query: 'tell me about optical bench drift',
            generatedAt: '2026-07-05T00:00:00.000Z',
            sourceBoundary: 'full_document',
            budget: {
                maxFragments: 4,
                maxCharsPerFragment: 900,
                maxTotalChars: 2600,
            },
            fragments: [
                {
                    fragmentId: 'rag_direct_generic_optical_bench_drift',
                    role: 'direct_support',
                    text: [
                        'This note begins with a broad overview of laboratory documentation.',
                        'Optical bench drift is detected by comparing the reference beam against the current beam centroid.',
                        'Drift correction requires recording the centroid delta before changing hardware.',
                    ].join(' '),
                    atomId: 'atom_generic_optical_bench_drift',
                    documentId: 'doc_generic_optical_bench_drift',
                    sourcePath: 'Knowledge_Base/test/optical-bench-drift.md',
                    title: 'Optical Bench Drift',
                    headingPath: ['Optical Bench Drift', 'Detection'],
                    startLine: 6,
                    endLine: 11,
                    charCount: 222,
                    tokenEstimate: 44,
                    truncated: false,
                    citationIds: ['evidence_generic_optical_bench_drift'],
                    sourceBoundary: 'direct_span_only',
                },
                {
                    fragmentId: 'rag_direct_generic_optical_bench_drift_environment',
                    role: 'direct_support',
                    text: 'Ambient temperature changes shift the optical bench reference position.',
                    atomId: 'atom_generic_optical_bench_drift_environment',
                    documentId: 'doc_generic_optical_bench_drift',
                    sourcePath: 'Knowledge_Base/test/optical-bench-drift.md',
                    title: 'Optical Bench Drift Environment',
                    headingPath: ['Optical Bench Drift', 'Environmental cause'],
                    startLine: 14,
                    endLine: 14,
                    charCount: 71,
                    tokenEstimate: 14,
                    truncated: false,
                    citationIds: ['evidence_generic_optical_bench_drift'],
                    sourceBoundary: 'full_document',
                    score: 0.93,
                },
                {
                    fragmentId: 'rag_direct_generic_optical_bench_drift_mount',
                    role: 'direct_support',
                    text: 'Mount relaxation changes the beam angle while the detector remains stable.',
                    atomId: 'atom_generic_optical_bench_drift_mount',
                    documentId: 'doc_generic_optical_bench_drift',
                    sourcePath: 'Knowledge_Base/test/optical-bench-drift.md',
                    title: 'Optical Bench Drift Mount',
                    headingPath: ['Optical Bench Drift', 'Mechanical cause'],
                    startLine: 15,
                    endLine: 15,
                    charCount: 72,
                    tokenEstimate: 14,
                    truncated: false,
                    citationIds: ['evidence_generic_optical_bench_drift'],
                    sourceBoundary: 'full_document',
                    score: 0.92,
                },
                {
                    fragmentId: 'rag_direct_generic_optical_bench_drift_history',
                    role: 'direct_support',
                    text: 'A time-series baseline separates persistent bench drift from transient detector noise.',
                    atomId: 'atom_generic_optical_bench_drift_history',
                    documentId: 'doc_generic_optical_bench_drift',
                    sourcePath: 'Knowledge_Base/test/optical-bench-drift.md',
                    title: 'Optical Bench Drift History',
                    headingPath: ['Optical Bench Drift', 'Historical baseline'],
                    startLine: 16,
                    endLine: 16,
                    charCount: 83,
                    tokenEstimate: 16,
                    truncated: false,
                    citationIds: ['evidence_generic_optical_bench_drift'],
                    sourceBoundary: 'full_document',
                    score: 0.91,
                },
                {
                    fragmentId: 'rag_parent_generic_optical_bench_drift',
                    role: 'parent_context',
                    text: 'The procedure context says stable baseline records distinguish drift from alignment noise.',
                    atomId: 'atom_generic_optical_bench_drift',
                    documentId: 'doc_generic_optical_bench_drift',
                    sourcePath: 'Knowledge_Base/test/optical-bench-drift.md',
                    title: 'Optical Bench Drift',
                    headingPath: ['Optical Bench Drift', 'Context'],
                    startLine: 2,
                    endLine: 5,
                    charCount: 86,
                    tokenEstimate: 15,
                    truncated: false,
                    citationIds: ['evidence_generic_optical_bench_drift'],
                    sourceBoundary: 'full_document',
                },
                {
                    fragmentId: 'rag_graph_generic_optical_bench_drift',
                    role: 'graph_neighbor_support',
                    text: 'Graph caveat: downstream calibration quality depends on the beam stability check.',
                    atomId: 'atom_generic_optical_bench_drift',
                    documentId: 'doc_generic_optical_bench_drift',
                    sourcePath: 'Knowledge_Base/test/optical-bench-drift.md',
                    title: 'Beam Stability Check',
                    headingPath: ['Optical Bench Drift', 'Graph'],
                    startLine: 12,
                    endLine: 13,
                    charCount: 78,
                    tokenEstimate: 13,
                    truncated: false,
                    citationIds: ['evidence_generic_optical_bench_drift'],
                    relationEdgeIds: ['edge_drift_stability_check'],
                    sourceBoundary: 'full_document',
                },
            ],
            sourceDecisions: [],
            totalCharCount: 386,
            tokenEstimate: 72,
        };
        const ragSufficiencyReview: RagSufficiencyReview = {
            reviewedAt: '2026-07-05T00:00:00.000Z',
            status: 'sufficient',
            score: 0.88,
            reasons: [],
            deterministic: true,
            recoveryAttempted: false,
            llmJudgeUsed: false,
            degradationState: 'none',
        };
        let blockCounter = 0;

        const reply = buildScopedConversationReply({
            message: 'tell me about optical bench drift',
            knowledgePoints,
            citations,
            recalledMemories: [],
            memoryActions: [],
            usedScope: globalScope,
            generatedAt: '2026-07-05T00:00:00.000Z',
            nextBlockId: () => `assistant_block_${++blockCounter}`,
            ragContextPack,
            ragSufficiencyReview,
        });

        expect(reply.answerReleaseReview.originalAnswer).toContain('downstream calibration quality');
        expect(reply.answerReleaseReview.gates.filter((gate) => !gate.passed)).toEqual([]);
        expect(reply.answer).toContain('reference beam against the current beam centroid');
        expect(reply.answer).toContain('centroid delta before changing hardware');
        expect(reply.answer).toContain('stable baseline records');
        expect(reply.answer).toContain('downstream calibration quality');
        expect(reply.answer).toContain('Ambient temperature changes');
        expect(reply.answer).toContain('Mount relaxation changes');
        expect(reply.answer).toContain('time-series baseline separates');
        expect(reply.graphAnswerCoverage.passed).toBe(true);
        expect(reply.answer).not.toContain('broad overview of laboratory documentation');
        expect(reply.answer).not.toContain('Graph caveat:');
    });

    test('renders every planned direct-support claim without an intent profile quota', () => {
        const item = makeQueryItem({
            atom: {
                id: 'atom_profile_free_beam_drift',
                documentId: 'doc_profile_free_beam_drift',
                sourcePath: 'Knowledge_Base/test/profile-free-beam-drift.md',
                title: 'Beam Drift',
                content: 'Beam drift is a displacement of the measured spot.',
            },
            evidence: {
                id: 'evidence_profile_free_beam_drift',
                snippet: 'Beam drift is a displacement of the measured spot.',
                startLine: 3,
                endLine: 6,
            },
            score: 0.93,
        });
        const knowledgePoints = mergeAgentConversationKnowledgePoints([item], () => []);
        const citations = knowledgePoints.flatMap((point) => point.citations || []);
        let blockCounter = 0;

        const reply = buildScopedConversationReply({
            message: 'tell me about beam drift',
            knowledgePoints,
            citations,
            recalledMemories: [],
            memoryActions: [],
            usedScope: globalScope,
            generatedAt: '2026-07-22T00:00:00.000Z',
            nextBlockId: () => `assistant_block_${++blockCounter}`,
            ragSufficiencyReview: {
                reviewedAt: '2026-07-22T00:00:00.000Z',
                status: 'sufficient',
                score: 0.9,
                reasons: [],
                deterministic: true,
                recoveryAttempted: false,
                llmJudgeUsed: false,
                degradationState: 'none',
            },
            ragContextPack: {
                query: 'tell me about beam drift',
                generatedAt: '2026-07-22T00:00:00.000Z',
                sourceBoundary: 'direct_span_only',
                budget: { maxFragments: 1, maxCharsPerFragment: 1000, maxTotalChars: 1000 },
                fragments: [{
                    fragmentId: 'direct_profile_free_beam_drift',
                    role: 'direct_support',
                    text: [
                        'Beam drift is a displacement of the measured spot.',
                        'It can be measured against a fixed reference mark.',
                        'Its correction requires recording the centroid shift before adjustment.',
                    ].join(' '),
                    atomId: 'atom_profile_free_beam_drift',
                    documentId: 'doc_profile_free_beam_drift',
                    sourcePath: 'Knowledge_Base/test/profile-free-beam-drift.md',
                    title: 'Beam Drift',
                    headingPath: ['Beam Drift'],
                    startLine: 3,
                    endLine: 6,
                    charCount: 163,
                    tokenEstimate: 39,
                    truncated: false,
                    citationIds: ['evidence_profile_free_beam_drift'],
                    sourceBoundary: 'direct_span_only',
                    score: 0.7,
                }],
                sourceDecisions: [],
                totalCharCount: 163,
                tokenEstimate: 39,
            },
        });

        expect(reply.answer).toContain('It can be measured against a fixed reference mark');
        expect(reply.answer).toContain('Its correction requires recording the centroid shift before adjustment');
    });

    test('projects definition answers to bounded non-comparison claims while retaining formula integrity', () => {
        const item = makeQueryItem({
            atom: {
                id: 'atom_projection_water_glass',
                documentId: 'doc_projection_water_glass',
                title: 'Water Glass',
                content: 'A water glass is a transparent vessel used to hold water.',
            },
            evidence: {
                id: 'evidence_projection_water_glass',
                snippet: 'A water glass is a transparent vessel used to hold water.',
            },
            score: 0.95,
        });
        const projectionPoints = mergeAgentConversationKnowledgePoints([item], () => []);
        const densePack: RagContextPack = {
            query: 'what is water glass?',
            generatedAt: '2026-07-12T00:00:00.000Z',
            sourceBoundary: 'direct_span_only',
            budget: { maxFragments: 1, maxCharsPerFragment: 1000, maxTotalChars: 1000 },
            fragments: [{
                fragmentId: 'definition_projection_dense',
                role: 'direct_support',
                atomId: 'atom_projection_water_glass',
                documentId: 'doc_projection_water_glass',
                sourcePath: 'Knowledge_Base/test/projection-water-glass.md',
                title: 'Water Glass',
                headingPath: ['Water Glass'],
                text: [
                    'A water glass is a transparent vessel used to hold water.',
                    'It separates the liquid from the surrounding environment.',
                    'Its wall conducts heat between the drink and the air.',
                    'It is compared with a PET Plastic Cup and a Stainless Steel Metal Cup.',
                    'The water glass thermal field follows $$\\frac{\\partial T}{\\partial t}=\\alpha\\nabla^2 T$$.',
                    'This extra sentence should remain outside the compact definition answer.',
                ].join(' '),
                charCount: 330,
                tokenEstimate: 80,
                truncated: false,
                citationIds: ['evidence_projection_water_glass'],
                sourceBoundary: 'direct_span_only',
                score: 0.95,
            }],
            sourceDecisions: [],
            totalCharCount: 330,
            tokenEstimate: 80,
        };
        const reply = buildScopedConversationReply({
            message: 'what is water glass?',
            knowledgePoints: projectionPoints,
            citations: [],
            recalledMemories: [],
            memoryActions: [],
            usedScope: globalScope,
            generatedAt: '2026-07-12T00:00:00.000Z',
            nextBlockId: (() => {
                let index = 0;
                return () => `projection_block_${++index}`;
            })(),
            ragContextPack: densePack,
            ragSufficiencyReview: {
                reviewedAt: '2026-07-12T00:00:00.000Z',
                status: 'sufficient',
                score: 0.9,
                reasons: [],
                deterministic: true,
                recoveryAttempted: false,
                llmJudgeUsed: false,
                degradationState: 'none',
            },
        });

        expect(reply.answer).toContain('A water glass is a transparent vessel used to hold water.');
        expect(reply.answer).toContain('It separates the liquid from the surrounding environment.');
        expect(reply.answer).toContain('Its wall conducts heat between the drink and the air.');
        expect(reply.answer).toContain('$$\n\\frac{\\partial T}{\\partial t}=\\alpha\\nabla^2 T\n$$');
        expect(reply.answer).not.toContain('PET Plastic Cup');
        expect(reply.answer).not.toContain('Stainless Steel Metal Cup');
        expect(reply.answer).not.toContain('This extra sentence should remain outside');
        expect(reply.graphAnswerPlan).toEqual(reply.answerReleaseReview.publicGraphAnswerPlan);
        expect(reply.graphAnswerCoverage).toEqual(reply.answerReleaseReview.graphAnswerCoverage);
        expect(reply.knowledgeRun.graphAnswerPlan).toEqual(reply.graphAnswerPlan);
        expect(reply.knowledgeRun.graphAnswerCoverage).toEqual(reply.graphAnswerCoverage);
        expect((reply.answer.match(/\$\$/gu) || []).length % 2).toBe(0);
        expect((reply.answer.match(/\\frac\{\\partial T\}\{\\partial t\}=\\alpha\\nabla\^2 T/gu) || [])).toHaveLength(1);
        expect(reply.answer.trim()).not.toMatch(/(?:and|or|with|between|is|are|:|：)\s*$/iu);
    });

    test('compound Chinese definition queries keep the subject answer and complete formula while dropping document scaffolding', () => {
        const items = [
            makeQueryItem({
                atom: {
                    id: 'atom_amorphous_ice_definition',
                    documentId: 'doc_amorphous_ice',
                    title: '非晶冰',
                    sourcePath: 'Knowledge_Base/waterglass/Amorphous ice.md',
                    content: '## 非晶冰\n非晶冰（Amorphous ice）是水的一种固态形式，其分子排列缺乏长程有序结构。',
                    keywords: ['非晶冰', 'amorphous', 'ice'],
                },
                evidence: {
                    id: 'evidence_amorphous_ice_definition',
                    sourcePath: 'Knowledge_Base/waterglass/Amorphous ice.md',
                    snippet: '## 非晶冰\n非晶冰（Amorphous ice）是水的一种固态形式，其分子排列缺乏长程有序结构。',
                    startLine: 3,
                    endLine: 6,
                },
                score: 0.98,
            }),
            makeQueryItem({
                atom: {
                    id: 'atom_amorphous_ice_math',
                    documentId: 'doc_amorphous_ice',
                    title: '核心概念与数学基础',
                    sourcePath: 'Knowledge_Base/waterglass/Amorphous ice.md',
                    content: '### 核心概念与数学基础\n其结构可用径向分布函数 $g(r)$ 描述。\n$$ g(r) = \\frac{V}{N^2} \\left\\langle \\sum_{i=1}^{N} \\delta(r) \\right\\rangle $$',
                    keywords: ['核心概念', '数学基础', '非晶冰', 'g', 'r'],
                },
                evidence: {
                    id: 'evidence_amorphous_ice_math',
                    sourcePath: 'Knowledge_Base/waterglass/Amorphous ice.md',
                    snippet: '### 核心概念与数学基础\n其结构可用径向分布函数 $g(r)$ 描述。\n$$ g(r) = \\frac{V}{N^2} \\left\\langle \\sum_{i=1}^{N} \\delta(r) \\right\\rangle $$',
                    startLine: 7,
                    endLine: 18,
                },
                score: 0.86,
            }),
            makeQueryItem({
                atom: {
                    id: 'atom_amorphous_ice_application',
                    documentId: 'doc_amorphous_ice',
                    title: '常见用例与性能指标',
                    sourcePath: 'Knowledge_Base/waterglass/Amorphous ice.md',
                    content: '### 常见用例与性能指标\n本节介绍冷冻电子显微镜和天体物理学应用。',
                    keywords: ['常见用例', '性能指标', '应用'],
                },
                evidence: {
                    id: 'evidence_amorphous_ice_application',
                    sourcePath: 'Knowledge_Base/waterglass/Amorphous ice.md',
                    snippet: '### 常见用例与性能指标\n本节介绍冷冻电子显微镜和天体物理学应用。',
                    startLine: 48,
                    endLine: 52,
                },
                score: 0.62,
            }),
        ];
        const points = mergeAgentConversationKnowledgePoints(items, () => []);
        const reply = buildScopedConversationReply({
            message: '什么是非晶冰？我应该通过哪些知识点学习？',
            answerLanguage: 'zh',
            knowledgePoints: points,
            citations: points[0]?.citations || [],
            recalledMemories: [],
            memoryActions: [],
            usedScope: globalScope,
            generatedAt: '2026-09-01T00:00:00.000Z',
            nextBlockId: (() => {
                let index = 0;
                return () => `compound_definition_block_${++index}`;
            })(),
            ragContextPack: {
                query: '什么是非晶冰？我应该通过哪些知识点学习？',
                generatedAt: '2026-09-01T00:00:00.000Z',
                sourceBoundary: 'direct_span_only',
                budget: { maxFragments: 3, maxCharsPerFragment: 900, maxTotalChars: 2400 },
                fragments: [
                    {
                        fragmentId: 'rag_amorphous_ice_definition',
                        role: 'direct_support',
                        atomId: 'atom_amorphous_ice_definition',
                        documentId: 'doc_amorphous_ice',
                        sourcePath: 'Knowledge_Base/waterglass/Amorphous ice.md',
                        title: '非晶冰',
                        headingPath: ['非晶冰'],
                        text: '## 非晶冰\n非晶冰（Amorphous ice）是水的一种固态形式，其分子排列缺乏长程有序结构。',
                        startLine: 3,
                        endLine: 6,
                        charCount: 80,
                        tokenEstimate: 20,
                        truncated: false,
                        citationIds: ['evidence_amorphous_ice_definition'],
                        relationEdgeIds: [],
                        sourceBoundary: 'direct_span_only',
                        score: 0.98,
                    },
                    {
                        fragmentId: 'rag_amorphous_ice_math',
                        role: 'direct_support',
                        atomId: 'atom_amorphous_ice_math',
                        documentId: 'doc_amorphous_ice',
                        sourcePath: 'Knowledge_Base/waterglass/Amorphous ice.md',
                        title: '核心概念与数学基础',
                        headingPath: ['非晶冰', '核心概念与数学基础'],
                        text: '### 核心概念与数学基础\n其结构可用径向分布函数 $g(r)$ 描述。\n$$ g(r) = \\frac{V}{N^2} \\left\\langle \\sum_{i=1}^{N} \\delta(r) \\right\\rangle $$',
                        startLine: 7,
                        endLine: 18,
                        charCount: 160,
                        tokenEstimate: 40,
                        truncated: false,
                        citationIds: ['evidence_amorphous_ice_math'],
                        relationEdgeIds: [],
                        sourceBoundary: 'direct_span_only',
                        score: 0.86,
                    },
                    {
                        fragmentId: 'rag_amorphous_ice_technical_noise',
                        role: 'direct_support',
                        atomId: 'atom_amorphous_ice_application',
                        documentId: 'doc_amorphous_ice',
                        sourcePath: 'Knowledge_Base/waterglass/Amorphous ice.md',
                        title: '关键技术规格',
                        headingPath: ['非晶冰', '关键技术规格'],
                        text: '### 关键技术规格\n非晶冰存在多种形态，玻璃化转变温度为 $T_g$。',
                        startLine: 32,
                        endLine: 45,
                        charCount: 70,
                        tokenEstimate: 18,
                        truncated: false,
                        citationIds: ['evidence_amorphous_ice_application'],
                        relationEdgeIds: [],
                        sourceBoundary: 'direct_span_only',
                        score: 0.72,
                    },
                    {
                        fragmentId: 'rag_amorphous_ice_math_duplicate',
                        role: 'parent_context',
                        atomId: 'atom_amorphous_ice_math',
                        documentId: 'doc_amorphous_ice',
                        sourcePath: 'Knowledge_Base/waterglass/Amorphous ice.md',
                        title: '核心概念与数学基础',
                        headingPath: ['非晶冰', '核心概念与数学基础'],
                        text: '核心概念重复说明：$$ g(r) = \\frac{V}{N^2} \\left\\langle \\sum_{i=1}^{N} \\delta(r) \\right\\rangle $$。',
                        startLine: 19,
                        endLine: 23,
                        charCount: 110,
                        tokenEstimate: 28,
                        truncated: false,
                        citationIds: ['evidence_amorphous_ice_math'],
                        relationEdgeIds: [],
                        sourceBoundary: 'full_document',
                        score: 0.65,
                    },
                ],
                sourceDecisions: [],
                totalCharCount: 240,
                tokenEstimate: 60,
            },
            ragSufficiencyReview: {
                reviewedAt: '2026-09-01T00:00:00.000Z',
                status: 'sufficient',
                score: 0.95,
                reasons: [],
                deterministic: true,
                recoveryAttempted: false,
                llmJudgeUsed: false,
                degradationState: 'none',
            },
        });

        expect(reply.answer).toContain('非晶冰（Amorphous ice）是水的一种固态形式');
        expect(reply.answer).toContain('$g(r)$');
        expect(reply.answer).toContain('$$');
        expect(reply.answer).not.toMatch(/###\s+(?!建议学习路径)/u);
        expect(reply.answer).not.toContain('常见用例与性能指标');
        expect(reply.answer).not.toContain('关键技术规格');
        expect(reply.answer).not.toContain('$T_g$');
        expect(reply.answer).not.toContain('本节介绍');
        expect(reply.answer).not.toContain('水杯');
        expect((reply.answer.match(/\\frac\{V\}\{N\^2\}/gu) || [])).toHaveLength(1);
        expect(reply.answer).toContain('\n\n$$\n');
        expect(reply.answer).toContain('\n### 建议学习路径\n');
        expect(reply.answer).toContain('1. **核心结构与数学基础**');
        expect(reply.answer).toContain('当前资料顺序，不代表显式前置关系');
        expect(reply.answer).not.toContain('后续分支包括');
        const structuredBlock = reply.assistantBlocks.find((block) => block.type === 'structured_answer');
        expect(structuredBlock && 'answerTaskPlan' in structuredBlock ? structuredBlock.answerTaskPlan : undefined)
            .toEqual(expect.objectContaining({
                schemaVersion: '1',
                subtasks: expect.arrayContaining([
                    expect.objectContaining({ kind: 'learning_route', required: true }),
                ]),
            }));
        expect(reply.answerReleaseReview.answerTaskCoverage).toEqual(expect.objectContaining({
            passed: true,
            coveredSubtaskIds: expect.arrayContaining(['learning_route']),
        }));
    });

    test('compound definition release stays bounded when the RAG pack contains a full document', () => {
        const sourcePath = 'Knowledge_Base/waterglass/Amorphous ice.md';
        const documentText = [
            '## 非晶冰',
            '非晶冰（Amorphous ice）是水的一种固态形式，其分子排列缺乏晶体冰的长程有序结构。',
            '### 核心概念与数学基础',
            '其结构可用径向分布函数 $g(r)$ 描述。',
            '$$ g(r) = \\frac{V}{N^2} \\left\\langle \\sum_{i=1}^{N} \\delta(r) \\right\\rangle $$',
            '#### 4. 热力学：热量传递',
            '系统内部的温度场由热传导方程描述。',
            '### 常见用例与性能指标',
            '非晶冰可用于冷冻电子显微镜和天体物理学研究。',
            '### 关键技术规格',
            '不同密度和制备方法会形成不同形态。',
            '### 相关技术与比较数学模型',
            '```mermaid\ngraph LR\nA[非晶冰] --> B[晶体冰]\n```',
        ].join('\n');
        const item = makeQueryItem({
            atom: {
                id: 'atom_full_document_amorphous_ice',
                documentId: 'doc_full_document_amorphous_ice',
                title: '非晶冰',
                sourcePath,
                content: documentText,
                keywords: ['非晶冰', 'amorphous', 'ice'],
            },
            evidence: {
                id: 'evidence_full_document_amorphous_ice',
                sourcePath,
                snippet: documentText,
                startLine: 1,
                endLine: 12,
            },
            score: 0.98,
        });
        const points = mergeAgentConversationKnowledgePoints([item], () => []);
        const reply = buildScopedConversationReply({
            message: '什么是非晶冰？我应该通过哪些知识点学习？',
            answerLanguage: 'zh',
            knowledgePoints: points,
            citations: points[0]?.citations || [],
            recalledMemories: [],
            memoryActions: [],
            usedScope: globalScope,
            generatedAt: '2026-09-01T00:20:00.000Z',
            nextBlockId: (() => {
                let index = 0;
                return () => `full_document_compound_block_${++index}`;
            })(),
            ragContextPack: {
                query: '什么是非晶冰？我应该通过哪些知识点学习？',
                generatedAt: '2026-09-01T00:20:00.000Z',
                sourceBoundary: 'full_document',
                budget: { maxFragments: 4, maxCharsPerFragment: 1600, maxTotalChars: 5000 },
                fragments: [
                    {
                        fragmentId: 'rag_full_document_amorphous_ice',
                        role: 'direct_support',
                        atomId: 'atom_full_document_amorphous_ice',
                        documentId: 'doc_full_document_amorphous_ice',
                        sourcePath,
                        title: '非晶冰',
                        headingPath: ['非晶冰'],
                        text: documentText,
                        startLine: 1,
                        endLine: 12,
                        charCount: documentText.length,
                        tokenEstimate: 180,
                        truncated: false,
                        citationIds: ['evidence_full_document_amorphous_ice'],
                        relationEdgeIds: [],
                        sourceBoundary: 'full_document',
                        score: 0.98,
                    },
                    {
                        fragmentId: 'rag_full_document_amorphous_ice_duplicate_formula',
                        role: 'parent_context',
                        atomId: 'atom_full_document_amorphous_ice',
                        documentId: 'doc_full_document_amorphous_ice',
                        sourcePath,
                        title: '核心概念与数学基础',
                        headingPath: ['非晶冰', '核心概念与数学基础'],
                        text: '核心概念重复说明：$$ g(r) = \\frac{V}{N^2} \\left\\langle \\sum_{i=1}^{N} \\delta(r) \\right\\rangle $$。',
                        startLine: 4,
                        endLine: 5,
                        charCount: 110,
                        tokenEstimate: 28,
                        truncated: false,
                        citationIds: ['evidence_full_document_amorphous_ice'],
                        relationEdgeIds: [],
                        sourceBoundary: 'full_document',
                        score: 0.7,
                    },
                ],
                sourceDecisions: [],
                totalCharCount: documentText.length + 110,
                tokenEstimate: 208,
            },
            ragSufficiencyReview: {
                reviewedAt: '2026-09-01T00:20:00.000Z',
                status: 'sufficient',
                score: 0.95,
                reasons: [],
                deterministic: true,
                recoveryAttempted: false,
                llmJudgeUsed: false,
                degradationState: 'none',
            },
        });

        expect(reply.answer).toContain('非晶冰（Amorphous ice）是水的一种固态形式');
        expect(reply.answer).toContain('g(r)');
        expect(reply.answer).toContain('$$');
        expect(reply.answer).not.toContain('常见用例与性能指标');
        expect(reply.answer).not.toContain('关键技术规格');
        expect(reply.answer).not.toContain('相关技术与比较数学模型');
        expect(reply.answer).not.toContain('```mermaid');
        expect(reply.graphAnswerPlan.answerTaskPlan?.learningRoute.length).toBeGreaterThanOrEqual(3);
        expect(reply.graphAnswerPlan.answerTaskPlan?.learningRoute.every((node) => node.evidenceRefs.length > 0)).toBe(true);
        expect(reply.answerReleaseReview.answerTaskCoverage).toEqual(expect.objectContaining({
            passed: true,
            coveredSubtaskIds: expect.arrayContaining(['definition', 'learning_route']),
        }));
        expect(reply.answer).not.toMatch(/(?:^|\\s)\\d+\\.?(?:\\s|$)/u);
        expect((reply.answer.match(/\\frac\{V\}\{N\^2\}/gu) || [])).toHaveLength(1);
        expect(reply.answer.length).toBeLessThan(900);
    });

    test('simple definition release keeps complete core formulas without expanding into later sections', () => {
        const sourcePath = 'Knowledge_Base/waterglass/water glass.md';
        const documentText = [
            '## 水杯 (water glass)',
            '此处的“水杯”被定义为一个由水和透明玻璃容器组成的物理系统。',
            '### 核心概念及其数学基础',
            '系统内部温度由热传导方程描述： $$ \\frac{\\partial T}{\\partial t}=\\alpha\\nabla^2 T $$。',
            '当光线穿过空气、玻璃和水时会发生折射，满足斯涅尔定律： $$ n_1\\sin(\\theta_1)=n_2\\sin(\\theta_2) $$。',
            '### 常见用例与量化性能指标',
            '静水压力可以用 P = rho g h 估算。',
            '### 相关技术与比较数学模型',
            '```mermaid\ngraph LR\nA[水杯] --> B[塑料杯]\n```',
        ].join('\n');
        const item = makeQueryItem({
            atom: {
                id: 'atom_full_document_water_glass',
                documentId: 'doc_full_document_water_glass',
                title: '水杯 (water glass)',
                sourcePath,
                content: documentText,
                keywords: ['水杯', 'water', 'glass'],
            },
            evidence: {
                id: 'evidence_full_document_water_glass',
                sourcePath,
                snippet: documentText,
                startLine: 1,
                endLine: 9,
            },
            score: 0.98,
        });
        const points = mergeAgentConversationKnowledgePoints([item], () => []);
        const reply = buildScopedConversationReply({
            message: '什么是waterglass?',
            answerLanguage: 'zh',
            knowledgePoints: points,
            citations: points[0]?.citations || [],
            recalledMemories: [],
            memoryActions: [],
            usedScope: globalScope,
            generatedAt: '2026-09-01T00:30:00.000Z',
            nextBlockId: (() => {
                let index = 0;
                return () => `simple_full_document_block_${++index}`;
            })(),
            ragContextPack: {
                query: '什么是waterglass?',
                generatedAt: '2026-09-01T00:30:00.000Z',
                sourceBoundary: 'full_document',
                budget: { maxFragments: 2, maxCharsPerFragment: 1800, maxTotalChars: 3600 },
                fragments: [{
                    fragmentId: 'rag_full_document_water_glass',
                    role: 'direct_support',
                    atomId: 'atom_full_document_water_glass',
                    documentId: 'doc_full_document_water_glass',
                    sourcePath,
                    title: '水杯 (water glass)',
                    headingPath: ['水杯 (water glass)'],
                    text: documentText,
                    startLine: 1,
                    endLine: 9,
                    charCount: documentText.length,
                    tokenEstimate: 160,
                    truncated: false,
                    citationIds: ['evidence_full_document_water_glass'],
                    relationEdgeIds: [],
                    sourceBoundary: 'full_document',
                    score: 0.98,
                }],
                sourceDecisions: [],
                totalCharCount: documentText.length,
                tokenEstimate: 160,
            },
            ragSufficiencyReview: {
                reviewedAt: '2026-09-01T00:30:00.000Z',
                status: 'sufficient',
                score: 0.95,
                reasons: [],
                deterministic: true,
                recoveryAttempted: false,
                llmJudgeUsed: false,
                degradationState: 'none',
            },
        });

        expect(reply.answer).toContain('水杯');
        expect(reply.answer).toContain('\\frac{\\partial T}{\\partial t}=\\alpha\\nabla^2 T');
        expect(reply.answer).toContain('n_1\\sin(\\theta_1)=n_2\\sin(\\theta_2)');
        expect(reply.answer).not.toContain('常见用例与量化性能指标');
        expect(reply.answer).not.toContain('相关技术与比较数学模型');
        expect(reply.answer).not.toContain('```mermaid');
        expect((reply.answer.match(/\\frac\{\\partial T\}\{\\partial t\}=\\alpha\\nabla\^2 T/gu) || [])).toHaveLength(1);
        expect((reply.answer.match(/n_1\\sin\(\\theta_1\)=n_2\\sin\(\\theta_2\)/gu) || [])).toHaveLength(1);
        expect(reply.answer.length).toBeLessThan(900);
    });

    test('uses the explicit answer language for grounded and deferred action text', () => {
        const item = makeQueryItem({
            atom: {
                id: 'atom_language_contract',
                documentId: 'doc_language_contract',
                title: 'Language Contract',
                content: 'A language contract keeps the answer and follow-up actions consistent.',
            },
            evidence: {
                id: 'evidence_language_contract',
                snippet: 'A language contract keeps the answer and follow-up actions consistent.',
            },
            score: 0.95,
        });
        const points = mergeAgentConversationKnowledgePoints([item], () => []);
        const buildReply = (answerLanguage: 'en' | 'zh') => buildScopedConversationReply({
            message: 'what is language contract?',
            answerLanguage,
            knowledgePoints: points,
            citations: points[0].citations || [],
            recalledMemories: [],
            memoryActions: [],
            usedScope: globalScope,
            generatedAt: '2026-07-12T00:10:00.000Z',
            nextBlockId: (() => {
                let index = 0;
                return () => `language_block_${answerLanguage}_${++index}`;
            })(),
        });

        const englishBlock = buildReply('en').assistantBlocks.find((block) => block.type === 'structured_answer');
        const chineseBlock = buildReply('zh').assistantBlocks.find((block) => block.type === 'structured_answer');
        expect(englishBlock && 'title' in englishBlock ? englishBlock.title : '').toBe('Grounded Answer');
        expect(chineseBlock && 'title' in chineseBlock ? chineseBlock.title : '').toBe('可信回答');
        expect(englishBlock && 'directAnswer' in englishBlock ? englishBlock.directAnswer : '').toMatch(/\.$/u);
        expect(englishBlock && 'nextActionsMarkdown' in englishBlock ? englishBlock.nextActionsMarkdown : '').toContain('## Next Actions');
        expect(chineseBlock && 'directAnswer' in chineseBlock ? chineseBlock.directAnswer : '').toMatch(/。$/u);
        expect(chineseBlock && 'nextActionsMarkdown' in chineseBlock ? chineseBlock.nextActionsMarkdown : '').toContain('## 下一步行动');
        expect(chineseBlock && 'nextActionsMarkdown' in chineseBlock ? chineseBlock.nextActionsMarkdown : '').not.toContain('## Next Actions');
        expect(chineseBlock && 'overviewMarkdown' in chineseBlock ? chineseBlock.overviewMarkdown : '').toContain('## \u56de\u7b54\u4e0a\u4e0b\u6587');
        expect(chineseBlock && 'explanationMarkdown' in chineseBlock ? chineseBlock.explanationMarkdown : '').toContain('## \u8bf4\u660e');
        expect(chineseBlock && 'evidenceMarkdown' in chineseBlock ? chineseBlock.evidenceMarkdown : '').toContain('## \u8bc1\u636e\u6458\u8981');
        expect(buildReply('zh').assistantBlocks).toEqual(expect.arrayContaining([
            expect.objectContaining({ type: 'knowledge_run_summary', title: '\u77e5\u8bc6\u8fd0\u884c' }),
            expect.objectContaining({ type: 'citations', title: '\u5f15\u7528' }),
            expect.objectContaining({ type: 'knowledge_actions', title: '\u77e5\u8bc6\u64cd\u4f5c' }),
            expect.objectContaining({ type: 'system_notice', text: expect.stringContaining('\u672a\u53ec\u56de') }),
        ]));
    });

    test('fails graph comparison gate when compare intent only has reference context and no real branch signal', () => {
        const knowledgePoints: AgentConversationKnowledgePoint[] = [
            {
                atomId: 'atom_compare_anchor',
                atomIds: ['atom_compare_anchor'],
                documentId: 'doc_compare_anchor',
                sourcePath: 'Knowledge_Base/test/compare-anchor.md',
                title: 'Reflection',
                summary: 'Reflection redirects optical energy.',
                evidenceSnippet: 'Reflection redirects optical energy.',
                score: 0.91,
                citation: null,
                citations: [],
                matchedSpans: [],
                matchCount: 0,
                relationPath: [],
                relationPathAtomIds: [],
                relationKinds: [],
                temporalValidity: {
                    isValid: true,
                    checkedAt: '2026-06-11T00:00:00.000Z',
                    reasons: [],
                    details: [],
                } as any,
                capabilities: [],
            },
        ];

        let blockCounter = 0;
        const reply = buildScopedConversationReply({
            message: '对比反射与吸收',
            knowledgePoints,
            citations: [],
            recalledMemories: [],
            memoryActions: [],
            usedScope: globalScope,
            nextBlockId: () => `assistant_block_${++blockCounter}`,
            graphContext: {
                anchorAtomId: 'atom_compare_anchor',
                anchorTitle: 'Reflection',
                anchorDocumentId: 'doc_compare_anchor',
                supportingAtomIds: ['atom_reference_only'],
                supportingTitles: ['Reference Note'],
                relationKinds: ['reference'],
                relationSummaries: [
                    {
                        relationKind: 'reference',
                        edgeIds: ['edge_reference_only'],
                        sourceAtomIds: ['atom_compare_anchor'],
                        targetAtomIds: ['atom_reference_only'],
                        averageConfidence: 0.74,
                    },
                ],
                knowledgePointRelations: [
                    {
                        edgeId: 'edge_reference_only',
                        relationKind: 'reference',
                        sourceAtomId: 'atom_compare_anchor',
                        sourceTitle: 'Reflection',
                        targetAtomId: 'atom_reference_only',
                        targetTitle: 'Reference Note',
                        confidence: 0.74,
                    },
                ],
                connectionPaths: [],
                predecessorWindow: [],
                successorWindow: [],
                evidenceSourceRefs: ['Knowledge_Base/test/compare-anchor.md:4'],
                diagnostics: {
                    graphOpsAvailable: true,
                    usedFallback: false,
                    selectedAnchorReason: 'title_mention',
                    candidateCount: 2,
                    supportNodeCount: 1,
                    supportNodeLimit: 2,
                    pathDepthLimit: 6,
                    missingConnectionPathSourceAtomIds: [],
                    missingPredecessorAtomIds: [],
                    missingSuccessorAtomIds: [],
                },
                temporalValidity: {
                    checkedAt: '2026-06-11T00:00:00.000Z',
                    allPointsValid: true,
                    warningReasons: [],
                    invalidKnowledgePointTitles: [],
                    edgeKinds: [],
                    details: [],
                },
            } as any,
        });

        expect(reply.knowledgeRun.quality.gates).toEqual(expect.arrayContaining([
            expect.objectContaining({
                gateId: 'graph_comparison_branch',
                passed: false,
            }),
        ]));
    });
});

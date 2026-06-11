import {
    buildScopedConversationReply,
    collectAgentConversationAtomIds,
    mergeAgentConversationKnowledgePoints,
} from './conversationComposer';
import type {
    AgentConversationKnowledgePoint,
    AgentConversationMemoryAction,
    AgentConversationMemoryRecord,
    EvidenceSpan,
    KnowledgeAtom,
    KnowledgeQueryItem,
    KnowledgeQueryResolvedScope,
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

        expect(reply.answer).toContain('Grounded by 1 knowledge point');
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
        expect(structuredBlock && 'directAnswer' in structuredBlock ? structuredBlock.directAnswer : '').toContain('Grounded by 1 knowledge point');
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
});

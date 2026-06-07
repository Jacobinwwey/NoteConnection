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
        relationPath: [],
        temporalValidity: {
            isValid: true,
            checkedAt: '2026-06-06T00:00:00.000Z',
            reasons: [],
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
            }),
        ];

        const points = mergeAgentConversationKnowledgePoints(items, (atomId) => [{ actionId: `focus_${atomId}` }]);
        expect(points).toHaveLength(1);
        expect(points[0].documentId).toBe('doc_grouped');
        expect(points[0].atomIds).toEqual(expect.arrayContaining(['atom_a', 'atom_b']));
        expect(points[0].citations?.length).toBe(2);
        expect(points[0].matchedSpans?.length).toBe(2);
        expect(points[0].matchCount).toBe(2);
    });

    test('builds intent-aware scoped reply blocks and preserves additive compatibility shape', () => {
        const knowledgePoints: AgentConversationKnowledgePoint[] = [
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
                capabilities: [{ actionId: 'open_focus_mode' }],
            },
        ];
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
            expect.arrayContaining(['main_markdown', 'system_notice', 'citations', 'knowledge_actions'])
        );
        const markdownBlocks = reply.assistantBlocks.filter((block) => block.type === 'main_markdown');
        expect(markdownBlocks.some((block) => block.markdown.includes('## Scoped Answer'))).toBe(true);
        expect(markdownBlocks.some((block) => block.markdown.includes('comparison baseline'))).toBe(true);
        expect(markdownBlocks.some((block) => block.markdown.includes('inspect the strongest nodes side by side'))).toBe(true);
        expect(markdownBlocks.some((block) => block.markdown.includes('Persist the latest user focus to scoped conversation memory'))).toBe(true);
        const actionBlock = reply.assistantBlocks.find((block) => block.type === 'knowledge_actions');
        expect(actionBlock && 'atomIds' in actionBlock ? actionBlock.atomIds : []).toEqual(['atom_a', 'atom_b']);
        expect(collectAgentConversationAtomIds(knowledgePoints)).toEqual(['atom_a', 'atom_b']);
    });
});

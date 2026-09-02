import { projectAnswerForMobile } from './mobileAnswerProjection';
import type { AgentConversationResponse } from './types';

describe('mobile answer projection', () => {
    test('keeps a bounded task result and drops internal RAG payloads', () => {
        const response = {
            answer: '非晶冰是水的一种缺乏长程有序的固态形式。建议学习路径：1. 水分子与氢键网络 -> 2. 非晶冰 -> 3. 径向分布函数 g(r)。',
            assistantMessage: 'same',
            answerTaskPlan: {
                schemaVersion: '1',
                primarySubject: '非晶冰',
                requestedDepth: 'standard',
                subtasks: [
                    { subtaskId: 'definition', kind: 'definition', subject: '非晶冰', required: true, expectedOutput: 'direct_answer' },
                    { subtaskId: 'learning_route', kind: 'learning_route', subject: '非晶冰', required: true, expectedOutput: 'ordered_nodes' },
                ],
                learningRoute: [
                    { nodeId: 'water', title: '水分子与氢键网络', role: 'prerequisite', order: 1, orderingBasis: 'source_order', evidenceRefs: ['e1'], reason: '基础' },
                    { nodeId: 'ice', title: '非晶冰', role: 'core', order: 2, orderingBasis: 'source_order', evidenceRefs: ['e2'], reason: '核心' },
                    { nodeId: 'rdf', title: '径向分布函数 g(r)', role: 'mechanism', order: 3, orderingBasis: 'source_order', evidenceRefs: ['e3'], reason: '机制' },
                ],
            },
            citations: [
                {
                    citationId: 'e1', atomId: 'water', documentId: 'doc', sourcePath: 'Knowledge_Base/waterglass/water.md', title: '水分子', snippet: 'full source text should not be copied', startLine: 2, endLine: 3, score: 0.9,
                },
            ],
            trace: {
                ragContextPack: { fragments: [{ text: 'large internal source body' }] },
            },
        } as unknown as AgentConversationResponse;

        const projection = projectAnswerForMobile(response);
        expect(projection).toEqual(expect.objectContaining({
            schemaVersion: 1,
            primarySubject: '非晶冰',
            directAnswer: '非晶冰是水的一种缺乏长程有序的固态形式。',
            route: [
                expect.objectContaining({ title: '水分子与氢键网络', role: 'prerequisite', order: 1 }),
                expect.objectContaining({ title: '非晶冰', role: 'core', order: 2 }),
                expect.objectContaining({ title: '径向分布函数 g(r)', role: 'mechanism', order: 3 }),
            ],
            citations: [expect.objectContaining({ title: '水分子', sourcePath: 'Knowledge_Base/waterglass/water.md' })],
        }));
        expect(JSON.stringify(projection)).not.toContain('large internal source body');
        expect(JSON.stringify(projection)).not.toContain('full source text should not be copied');
    });

    test('preserves display-math Markdown while removing the appended learning route', () => {
        const response = {
            answer: [
                '非晶冰是缺乏长程有序的水的固态形式。',
                '',
                '$$',
                'g(r) = \\frac{1}{4\\pi r^2\\rho} \\frac{dN}{dr}',
                '$$',
                '',
                '### 建议学习路径',
                '',
                '1. **水分子**（前置）',
            ].join('\n'),
            assistantMessage: 'fallback',
            citations: [],
            answerTaskPlan: {
                schemaVersion: '1',
                primarySubject: '非晶冰',
                requestedDepth: 'standard',
                subtasks: [
                    { subtaskId: 'definition', kind: 'definition', subject: '非晶冰', required: true, expectedOutput: 'direct_answer' },
                    { subtaskId: 'learning_route', kind: 'learning_route', subject: '非晶冰', required: true, expectedOutput: 'ordered_nodes' },
                ],
                learningRoute: [],
            },
        } as unknown as AgentConversationResponse;

        const projection = projectAnswerForMobile(response);
        expect(projection.directAnswer).toContain('$$\ng(r) = \\frac{1}{4\\pi r^2\\rho} \\frac{dN}{dr}\n$$');
        expect(projection.directAnswer).not.toContain('建议学习路径');
        expect((projection.directAnswer.match(/(?<!\\)\$\$/gu) || []).length % 2).toBe(0);
    });

    test('does not leave an unmatched display-math fence when the mobile budget truncates an answer', () => {
        const longPrefix = '说明。'.repeat(500);
        const response = {
            answer: `${longPrefix}\n\n$$\nE = mc^2\n$$`,
            assistantMessage: '',
            citations: [],
        } as unknown as AgentConversationResponse;

        const projection = projectAnswerForMobile(response);
        expect(projection.directAnswer.length).toBeLessThanOrEqual(2400);
        expect((projection.directAnswer.match(/(?<!\\)\$\$/gu) || []).length % 2).toBe(0);
    });

    test('uses the response-level answer as the canonical release over a stale structured block', () => {
        const response = {
            answer: 'Canonical released answer for the subject.',
            assistantMessage: 'Canonical released answer for the subject.',
            assistantBlocks: [{
                blockId: 'stale',
                type: 'structured_answer',
                directAnswer: 'Stale block answer that must not win.',
            }],
            citations: [],
        } as unknown as AgentConversationResponse;

        expect(projectAnswerForMobile(response).directAnswer).toBe('Canonical released answer for the subject.');
    });
});
